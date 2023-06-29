// @ts-check
const process = require('process');
const { promisify } = require('util');
const path = require('path');
const childProcess = require('child_process');

const TEN_MEGABYTES = 1000 * 1000 * 10;
const execFile = promisify(childProcess.execFile);

const windows = async (option = {}) => {
	// Source: https://github.com/MarkTiedemann/fastlist
	let binary;
	switch (process.arch) {
		case 'x64':
			{
				if (!option.pslistX64Path) {
					throw new Error('Could not find 64-bit binary of fastlist');
				}
				binary = option.pslistX64Path;
			}
			break;
		case 'ia32':
			{
				if (!option.pslistIa32Path) {
					throw new Error('Could not find 32-bit binary of fastlist');
				}
				binary = option.pslistIa32Path;
			}
			break;
		default:
			throw new Error(`Unsupported architecture: ${process.arch}`);
	}

	const {stdout} = await execFile(binary, {
		maxBuffer: TEN_MEGABYTES,
		windowsHide: true,
	});

	return stdout
		.trim()
		.split('\r\n')
		.map(line => line.split('\t'))
		.map(([pid, ppid, name]) => ({
			pid: Number.parseInt(pid, 10),
			ppid: Number.parseInt(ppid, 10),
			name,
		}));
};

const nonWindowsMultipleCalls = async (options = {}) => {
	const flags = (options.all === false ? '' : 'a') + 'wwxo';
	const returnValue = {};

	await Promise.all(['comm', 'args', 'ppid', 'uid', '%cpu', '%mem'].map(async cmd => {
		const {stdout} = await execFile('ps', [flags, `pid,${cmd}`], {maxBuffer: TEN_MEGABYTES});

		for (let line of stdout.trim().split('\n').slice(1)) {
			line = line.trim();
			const [pid] = line.split(' ', 1);
			const value = line.slice(pid.length + 1).trim();

			if (returnValue[pid] === undefined) {
				returnValue[pid] = {};
			}

			returnValue[pid][cmd] = value;
		}
	}));

	// Filter out inconsistencies as there might be race
	// issues due to differences in `ps` between the spawns
	return Object.entries(returnValue)
		.filter(([, value]) => value.comm && value.args && value.ppid && value.uid && value['%cpu'] && value['%mem'])
		.map(([key, value]) => ({
			pid: Number.parseInt(key, 10),
			name: path.basename(value.comm),
			cmd: value.args,
			ppid: Number.parseInt(value.ppid, 10),
			uid: Number.parseInt(value.uid, 10),
			cpu: Number.parseFloat(value['%cpu']),
			memory: Number.parseFloat(value['%mem']),
		}));
};

const ERROR_MESSAGE_PARSING_FAILED = 'ps output parsing failed';

const psOutputRegex = /^[ \t]*(?<pid>\d+)[ \t]+(?<ppid>\d+)[ \t]+(?<uid>[-\d]+)[ \t]+(?<cpu>\d+\.\d+)[ \t]+(?<memory>\d+\.\d+)[ \t]+(?<comm>.*)?/;

const nonWindowsCall = async (options = {}) => {
	const flags = options.all === false ? 'wwxo' : 'awwxo';

	const psPromises = [
		execFile('ps', [flags, 'pid,ppid,uid,%cpu,%mem,comm'], {maxBuffer: TEN_MEGABYTES}),
		execFile('ps', [flags, 'pid,args'], {maxBuffer: TEN_MEGABYTES}),
	];

	const [psLines, psArgsLines] = (await Promise.all(psPromises)).map(({stdout}) => stdout.trim().split('\n'));

	const psPids = new Set(psPromises.map(promise => promise.child.pid));

	psLines.shift();
	psArgsLines.shift();

	const processCmds = {};
	for (const line of psArgsLines) {
		const [pid, cmds] = line.trim().split(' ');
		// @ts-ignore
		processCmds[pid] = cmds.join(' ');
	}

	const processes = psLines.map(line => {
		const match = psOutputRegex.exec(line);

		if (match === null) {
			throw new Error(ERROR_MESSAGE_PARSING_FAILED);
		}
		// @ts-ignore
		const {pid, ppid, uid, cpu, memory, comm} = match.groups;

		const processInfo = {
			pid: Number.parseInt(pid, 10),
			ppid: Number.parseInt(ppid, 10),
			uid: Number.parseInt(uid, 10),
			cpu: Number.parseFloat(cpu),
			memory: Number.parseFloat(memory),
			name: path.basename(comm),
			cmd: processCmds[pid],
		};

		return processInfo;
	}).filter(processInfo => !psPids.has(processInfo.pid));

	return processes;
};

const nonWindows = async (options = {}) => {
	try {
		return await nonWindowsCall(options);
	} catch { // If the error is not a parsing error, it should manifest itself in multicall version too.
		return nonWindowsMultipleCalls(options);
	}
};

module.exports.psList = process.platform === 'win32' ? windows : nonWindows;
