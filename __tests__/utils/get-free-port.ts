import { createServer } from 'net';

export async function getFreePort() {
  return new Promise<number>((res) => {
    const srv = createServer();
    srv.listen(0, () => {
      const address = srv.address();
      assertPortField(address);
      srv.close(() => res(address.port));
    });
  });
}

function assertPortField(x: unknown): asserts x is { port: number } {
  expect(x).toMatchObject({ port: expect.any(Number) });
}
