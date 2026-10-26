// ESLint 配置（flat config）
//
// 设计原则：只保留"能抓住 bug 的检查"。
//   1. 排版规则一条都不开 —— 单独跑一次格式化工具就能解决的事，不值得占用每次 lint 的
//      报错预算，也不值得让真正的问题淹没在缩进提示里。
//   2. 需要类型信息才能判断的规则才是这里的重点 —— 它们抓的是"能通过 tsc、但运行时行为
//      错"的代码，也就是 AI 生成代码最典型的失误模式（漏 await、乱加 ! / as、sort 不带
//      比较函数、模板字符串塞对象、判断条件永远为真……）。
//   3. 纯风格/历史包（eslint-config-standard-with-typescript 那套 200+ 条）已移除。

import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['dist/**', 'dts/**', 'coverage/**', 'node_modules/**', 'sekai-master-db-diff/**']
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        // 用 project service 自动为每个文件找所属 tsconfig，不需要手工维护 project 列表
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      // ── 异步：漏 await 是 AI 最高频的失误 ──────────────────────────────
      '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: true }],
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/promise-function-async': 'error',

      // ── 类型断言：AI 遇到类型报错就乱加 ! 和 as，把真问题藏起来 ────────
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'error',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'error',

      // ── 永不成立的条件 / 未覆盖的枚举分支 ────────────────────────────
      //    新增 EventType、Unit、bonusType 之类的枚举值时，忘了处理新分支会直接报错
      '@typescript-eslint/no-unnecessary-condition': [
        'error',
        // while (true) + break 是刻意的写法，不当作"条件恒真"报错
        { allowConstantLoopConditions: true }
      ],
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        { considerDefaultExhaustiveForUnions: true }
      ],
      '@typescript-eslint/no-unnecessary-type-constraint': 'error',

      // ── 隐式转换：空串/0 被当成 false、对象被塞进模板字符串 ──────────
      '@typescript-eslint/strict-boolean-expressions': 'error',
      // v8 默认放过 string + number，这里显式收紧，否则 'a' + id 这类隐式转换抓不到
      '@typescript-eslint/restrict-plus-operands': [
        'error',
        {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: false,
          allowRegExp: false
        }
      ],
      '@typescript-eslint/restrict-template-expressions': 'error',
      '@typescript-eslint/no-base-to-string': 'error',

      // ── 容易写错的库调用 ────────────────────────────────────────────
      '@typescript-eslint/require-array-sort-compare': 'error',
      '@typescript-eslint/no-for-in-array': 'error',
      '@typescript-eslint/no-confusing-void-expression': 'error',
      '@typescript-eslint/prefer-reduce-type-parameter': 'error',
      '@typescript-eslint/no-array-delete': 'error',

      // ── 死代码：复制粘贴留下的残留 ──────────────────────────────────
      '@typescript-eslint/no-unused-vars': [
        'error',
        { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true, vars: 'all' }
      ],
      'no-unreachable': 'error',

      // ── import 卫生 ────────────────────────────────────────────────
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' }
      ],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/no-require-imports': 'error'
    }
  },

  // 数据边界层：这里是 JSON / 泛型缓存的入口，`any` 是这一层的本质，不是偷懒。
  // 把 any 挡在边界内、不外泄给业务代码，才是这个 override 的意义。
  {
    files: ['src/data-provider/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off'
    }
  },

  // 测试代码：允许 jest 的全局变量，并放宽"必须处理 promise"（断言里常直接调）
  {
    files: ['test/**/*.ts'],
    languageOptions: { globals: { ...globals.jest } },
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      // 假的 DataProvider 要让方法签名返回 Promise，但不一定真的有 await
      '@typescript-eslint/require-await': 'off',
      // 测试里构造局部 mock 对象时用 any 是合理的
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off'
    }
  }
)
