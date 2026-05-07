# 仓库管理：临时步进值 + 数量输入框交互修复

日期：2026-05-07
范围：`src/components/WarehouseManager.tsx`

## 背景

仓库管理模块的"物资统计"面板支持通过 +/- 按钮调整每个角色对某物资的数量，但每次只能 ±1，整理大量物资时效率低。

同时，多处 `type="number"` 输入框存在交互问题：
- 清空内容后值会立即归 0，无法保留"空"作为编辑中间态
- 在已有 `0` 的情况下输入新数字会出现 `01`、`02` 这样的脏值
- 修改时需要先手动删除再输入，操作冗余

## 目标

1. 引入一个**临时全局步进值**（不持久化），作用于物资统计面板的 +/- 按钮
2. 修复所有 `type="number"` 输入框：聚焦时全选，失焦时归一化数值

## 详细设计

### 1. 步进值状态

在 `WarehouseManager` 内新增：

```ts
const [stepValue, setStepValue] = useState<number>(1);
```

- 默认 `1`
- 不通过 `storage` 持久化（刷新即重置）
- 最小值 `1`（避免无效步进）
- 当前 +/- 行为变更：`ch.quantity ± stepValue`

### 2. 步进值 UI

位置：`物资统计` 标题（第 981 行附近）所在行。改造为左右布局，左侧标题，右侧步进输入：

```
物资统计                                  步进 [ 1 ]
```

输入框样式参考已有的 `editTotalSlots`（`w-12 text-center font-mono`），并复用即将创建的 `QuantityInput` 组件，保证与其它数字输入框一致。

### 3. `QuantityInput` 组件（文件内私有组件）

封装数字输入交互。Props：

```ts
interface QuantityInputProps {
  value: number;
  onChange: (n: number) => void;
  min?: number;          // 默认 0
  className?: string;
}
```

行为：

- 内部维持 `string` 类型的本地状态 `draft`，初始为 `String(value)`
- 当外部 `value` 变化且当前未聚焦时，同步 `draft = String(value)`（避免 +/- 按钮变更后输入框不更新）
- `onFocus`：`e.target.select()`，全选内容
- `onChange`：仅更新 `draft`（允许临时空字符串、前导零等编辑中间态）
- `onBlur`：
  - 解析 `draft`（`parseInt(draft, 10)`）
  - 若结果为 `NaN`、为空或小于 `min`，归一为 `min`
  - 调用 `onChange(parsed)` 上报给父组件
  - 同步 `draft = String(parsed)`，确保 `01` 显示为 `1`

### 4. 应用范围

将 4 处现有 `type="number"` 输入框替换为 `QuantityInput`：

| 位置 | 行号（旧） | 用途 | min |
|------|-----------|------|-----|
| 编辑面板 - 总格数 | ~770 | 角色仓库总格数 | 1 |
| 编辑面板 - 数量 | ~878 | 物资数量（编辑中） | 0 |
| 编辑面板 - 占格 | ~888 | 物资占格（编辑中） | 0 |
| 统计面板 - 数量 | ~1009 | 内联调整数量 | 0 |
| 统计面板 - 步进值（新） | - | 全局步进 | 1 |

### 5. +/- 按钮联动步进值

`handleInlineQuantityChange` 调用方式由：

```tsx
onClick={() => handleInlineQuantityChange(ch.itemId, ch.quantity - 1)}
onClick={() => handleInlineQuantityChange(ch.itemId, ch.quantity + 1)}
```

改为：

```tsx
onClick={() => handleInlineQuantityChange(ch.itemId, ch.quantity - stepValue)}
onClick={() => handleInlineQuantityChange(ch.itemId, ch.quantity + stepValue)}
```

`handleInlineQuantityChange` 已使用 `Math.max(0, newQty)`，无需额外保护。

## 不在范围内

- 持久化步进值（明确要求刷新重置）
- 长按 +/- 连续递增等额外交互
- 价格设置、配方卡片中的其它数字输入（本次只改仓库模块）

## 验收

- 步进值改为 `4` 后，点 `+` 一次数量增加 `4`；点 `-` 一次数量减少 `4`（不低于 0）
- 刷新页面，步进值回到 `1`
- 在任一仓库内的数量/占格/总格数输入框点击或 Tab 进入：内容自动全选
- 在数量输入框中删空所有字符后输入 `1`：失焦后显示为 `1`，而非 `01`
- 在数量输入框中删空字符直接失焦：值归一为 `min`（数量为 `0`，总格数为 `1`）
