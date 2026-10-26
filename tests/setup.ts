// Metro turns `require('x.jpg')` into an asset id; in Node tests just return a number.
import Module from 'node:module'

const ext = (Module as unknown as { _extensions: Record<string, (m: { exports: unknown }) => void> })._extensions
for (const e of ['.jpg', '.jpeg', '.png']) {
  ext[e] = (m) => {
    m.exports = 1
  }
}
