#!/usr/bin/env node
/**
 * 从 src/ 里所有 getMasterData('xxx') 调用推导出需要注意的主数据表，按空格分隔输出一行。
 *
 * 清单由代码推导而不是手写：新增/删除主数据表时不需要再记得改 CI 配置。
 * CI 在拉主数据之前先跑这个脚本，用它输出的列表去下载——清单不完整就不可能开始下载。
 *
 * 用法：
 *   node script/master-db-files.cjs              # 打印清单
 *   for f in $(node script/master-db-files.cjs); do ...; done
 */
const fs = require('fs')
const path = require('path')

// 这些表是计算的基础，推导漏掉说明提取逻辑坏了（例如新写法没被正则覆盖），必须报错而不是少拉
const CORE_TABLES = ['cards', 'events', 'gameCharacters', 'skills']

function walk (dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(it => {
    const full = path.join(dir, it.name)
    if (it.isDirectory()) return walk(full)
    return it.name.endsWith('.ts') ? [full] : []
  })
}

const keys = new Set()
for (const file of walk('src')) {
  const text = fs.readFileSync(file, 'utf8')
  // 泛型可能跨行、实参可能换行
  for (const m of text.matchAll(/getMasterData<[\s\S]*?>\s*\(\s*['"]([^'"]+)['"]/g)) keys.add(m[1])
}

const missing = CORE_TABLES.filter(it => !keys.has(it))
if (missing.length > 0) {
  console.error(`主数据表推导失败，缺少基础表：${missing.join(', ')}`)
  process.exit(1)
}

process.stdout.write([...keys].sort().join(' '))
