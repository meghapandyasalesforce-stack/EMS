import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const handlerPath = path.join(root, 'public/push-handler.js')
const marker = "self.addEventListener('push'"
const handler = fs.readFileSync(handlerPath, 'utf-8')

const targets = [
  path.join(root, 'dist/sw.js'),
  path.join(root, 'dev-dist/sw.js'),
]

for (const swPath of targets) {
  if (!fs.existsSync(swPath)) continue
  const code = fs.readFileSync(swPath, 'utf-8')
  if (code.includes(marker)) continue
  fs.writeFileSync(swPath, `${handler}\n${code}`)
  console.log(`Patched push handlers into ${path.relative(root, swPath)}`)
}
