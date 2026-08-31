All pull requests that respect next rules are welcome:

- Before opening pull request to this repo run `npm t` to run tests.
- All bugfixes and features should contain tests, and coverage must stay at
  100% on every NestJS version of the CI matrix.

Use `npm run lint` to check, and `npm run lint:fix` to apply the fixable part.
CI runs the former, so a formatting-only failure means the latter was not run.

## A note on version-dependent behaviour

Some behaviour differs between supported NestJS majors — `NativeLogger`
collects extra plain objects into a `params` field the way NestJS 12 does, and
logs them as separate entries the way NestJS 11 does. Do not leave such a branch
covered only by the leg of the matrix that reaches it by default: make the
behaviour explicit through `Params['nativeLogger']` in the test, so both paths
run on every version.
