# @heyikang/ps-list
## Fork on [sindresorhus/ps-list](https://github.com/sindresorhus/ps-list)
> Get running processes, support electron

Works on macOS, Linux, and Windows.

## Install

```sh
npm install @heyikang/ps-list
```

## Usage

```js
const { psList } = require("@heyikang/ps-list");
// if windows
console.log(
	await psList({
		// Source: https://github.com/MarkTiedemann/fastlist
		pslistX64Path: "fastlist x64 executable path",
		pslistIa32Path: "fastlist x86 executable path",
	})
);
//=> [{pid: 3213, name: 'node', cmd: 'node test.js', ppid: 1, uid: 501, cpu: 0.1, memory: 1.5}, …]
```

## API

### psList(options?)

Returns a `Promise<object[]>` with the running processes.

On macOS and Linux, the `name` property is truncated to 15 characters by the system. The `cmd` property can be used to extract the full name.

The `cmd`, `cpu`, `memory`, and `uid` properties are not supported on Windows.

#### options

Type: `object`

##### all

Type: `boolean`\
Default: `true`

Include other users' processes as well as your own.

On Windows this has no effect and will always be the users' own processes.

## Related

- [fastlist](https://github.com/MarkTiedemann/fastlist) - The binary used in this module to list the running processes on Windows
