import { readdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const dir = './l10n'

for (const file of readdirSync(dir).filter(f => f.endsWith('.json'))) {
  const fp = join(dir, file)
  const obj = JSON.parse(readFileSync(fp, 'utf8'))
  writeFileSync(fp, JSON.stringify(obj, Object.keys(obj).sort(), 4) + '\n')
}
