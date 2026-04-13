import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { WarehouseItem, ItemType, ItemUnit } from "../lib/types";
import { loadWarehouseItems, saveWarehouseItems } from "../lib/storage";

const ITEM_TYPES: ItemType[] = ["食材", "木材", "花", "矿", "装备", "其他"];
const ITEM_UNITS: ItemUnit[] = ["个", "组", "箱"];

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

type ViewMode = "list" | "stats";

export default function WarehouseManager() {
  const [items, setItems] = useState<WarehouseItem[]>(() => loadWarehouseItems());
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [filterType, setFilterType] = useState<ItemType | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formCharacter, setFormCharacter] = useState("");
  const [formType, setFormType] = useState<ItemType>("食材");
  const [formName, setFormName] = useState("");
  const [formQuantity, setFormQuantity] = useState<number>(1);
  const [formUnit, setFormUnit] = useState<ItemUnit>("个");

  useEffect(() => {
    saveWarehouseItems(items);
  }, [items]);

  const filteredItems = useMemo(() => {
    let result = items;
    if (filterType) {
      result = result.filter((i) => i.itemType === filterType);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (i) =>
          i.itemName.toLowerCase().includes(q) ||
          i.characterName.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => a.itemName.localeCompare(b.itemName) || a.characterName.localeCompare(b.characterName));
  }, [items, filterType, searchQuery]);

  // Stats: group by item name
  const statsData = useMemo(() => {
    const map = new Map<string, { type: ItemType; unit: ItemUnit; characters: { name: string; quantity: number }[]; total: number }>();
    for (const item of items) {
      const key = `${item.itemName}|${item.unit}`;
      if (!map.has(key)) {
        map.set(key, { type: item.itemType, unit: item.unit, characters: [], total: 0 });
      }
      const entry = map.get(key)!;
      entry.characters.push({ name: item.characterName, quantity: item.quantity });
      entry.total += item.quantity;
    }
    let result = Array.from(map.entries()).map(([key, val]) => ({
      itemName: key.split("|")[0],
      ...val,
      characters: val.characters.sort((a, b) => b.quantity - a.quantity),
    }));
    if (filterType) {
      result = result.filter((i) => i.type === filterType);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((i) => i.itemName.toLowerCase().includes(q));
    }
    return result.sort((a, b) => a.itemName.localeCompare(b.itemName));
  }, [items, filterType, searchQuery]);

  const resetForm = useCallback(() => {
    setFormCharacter("");
    setFormType("食材");
    setFormName("");
    setFormQuantity(1);
    setFormUnit("个");
    setEditingId(null);
    setShowForm(false);
  }, []);

  const handleExport = useCallback(() => {
    const json = JSON.stringify(items, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `仓库数据_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [items]);

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!Array.isArray(data)) { alert("无效的数据格式"); return; }
        // Validate and assign new IDs to avoid conflicts
        const imported: WarehouseItem[] = data
          .filter((d: any) => d.characterName && d.itemName && d.itemType && d.quantity && d.unit)
          .map((d: any) => ({ ...d, id: generateId() }));
        if (imported.length === 0) { alert("未找到有效的物资记录"); return; }
        setItems((prev) => [...prev, ...imported]);
      } catch {
        alert("文件解析失败，请确认是有效的JSON文件");
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-imported
    e.target.value = "";
  }, []);

  const handleAdd = useCallback(() => {
    if (!formCharacter.trim() || !formName.trim() || formQuantity <= 0) return;
    if (editingId) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === editingId
            ? { ...i, characterName: formCharacter.trim(), itemType: formType, itemName: formName.trim(), quantity: formQuantity, unit: formUnit }
            : i
        )
      );
    } else {
      const newItem: WarehouseItem = {
        id: generateId(),
        characterName: formCharacter.trim(),
        itemType: formType,
        itemName: formName.trim(),
        quantity: formQuantity,
        unit: formUnit,
      };
      setItems((prev) => [...prev, newItem]);
    }
    resetForm();
  }, [formCharacter, formType, formName, formQuantity, formUnit, editingId, resetForm]);

  const handleEdit = useCallback((item: WarehouseItem) => {
    setFormCharacter(item.characterName);
    setFormType(item.itemType);
    setFormName(item.itemName);
    setFormQuantity(item.quantity);
    setFormUnit(item.unit);
    setEditingId(item.id);
    setShowForm(true);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (editingId === id) resetForm();
  }, [editingId, resetForm]);

  // Unique character names for autocomplete
  const characterNames = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.characterName))).sort();
  }, [items]);

  // Unique item names for autocomplete
  const itemNames = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.itemName))).sort();
  }, [items]);

  const inputCls = "w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500";
  const selectCls = "bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500";

  return (
    <div>
      {/* View mode toggle */}
      <div className="flex gap-1.5 mb-4">
        {([
          { id: "list" as ViewMode, label: "物资列表" },
          { id: "stats" as ViewMode, label: "物资统计" },
        ]).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setViewMode(tab.id)}
            className={`px-3.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-150 ${
              viewMode === tab.id
                ? "bg-accent-500 text-white shadow-sm shadow-accent-500/20"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Data warning */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 text-xs text-amber-700">
        数据完全存储在本地浏览器中，清理浏览器记录会导致数据丢失。建议定期导出备份。
      </div>

      {/* Import/Export */}
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={handleExport}
          disabled={items.length === 0}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          导出数据
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
        >
          导入数据
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          type="text"
          placeholder="搜索物资或角色..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-48 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
        />
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          <button
            type="button"
            onClick={() => setFilterType(null)}
            className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all duration-150 ${
              filterType === null
                ? "bg-accent-500 text-white shadow-sm shadow-accent-500/20"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
            }`}
          >
            全部
          </button>
          {ITEM_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilterType(t === filterType ? null : t)}
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all duration-150 ${
                filterType === t
                  ? "bg-accent-500 text-white shadow-sm shadow-accent-500/20"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        {viewMode === "list" && (
          <button
            type="button"
            onClick={() => { resetForm(); setShowForm(true); }}
            className="ml-auto px-3.5 py-1.5 rounded-lg text-xs font-medium bg-accent-500 text-white shadow-sm hover:bg-accent-600 transition-colors"
          >
            + 添加物资
          </button>
        )}
      </div>

      {/* Add/Edit form */}
      {showForm && viewMode === "list" && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            {editingId ? "编辑物资" : "添加物资"}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">角色名</label>
              <input
                type="text"
                value={formCharacter}
                onChange={(e) => setFormCharacter(e.target.value)}
                list="char-list"
                className={inputCls}
                placeholder="角色名"
              />
              <datalist id="char-list">
                {characterNames.map((n) => <option key={n} value={n} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">物资类型</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as ItemType)}
                className={selectCls + " w-full"}
              >
                {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">名称</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                list="item-list"
                className={inputCls}
                placeholder="物资名称"
              />
              <datalist id="item-list">
                {itemNames.map((n) => <option key={n} value={n} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">数量</label>
              <input
                type="number"
                value={formQuantity}
                onChange={(e) => setFormQuantity(Number(e.target.value) || 0)}
                min={1}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">单位</label>
              <select
                value={formUnit}
                onChange={(e) => setFormUnit(e.target.value as ItemUnit)}
                className={selectCls + " w-full"}
              >
                {ITEM_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={handleAdd}
                disabled={!formCharacter.trim() || !formName.trim() || formQuantity <= 0}
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-accent-500 text-white shadow-sm hover:bg-accent-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {editingId ? "保存" : "添加"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List view */}
      {viewMode === "list" && (
        filteredItems.length === 0 ? (
          <div className="text-center text-slate-400 mt-16 text-sm">
            {items.length === 0 ? "还没有添加任何物资记录" : "没有找到匹配的记录"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-gray-500 text-xs border-b border-gray-200 sticky top-0 bg-white">
                  <th className="py-2 px-2 font-medium">角色名</th>
                  <th className="py-2 px-2 font-medium">类型</th>
                  <th className="py-2 px-2 font-medium">名称</th>
                  <th className="py-2 px-2 font-medium text-right">数量</th>
                  <th className="py-2 px-2 font-medium">单位</th>
                  <th className="py-2 px-2 font-medium text-center">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-2 font-medium text-gray-800">{item.characterName}</td>
                    <td className="py-2 px-2">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                        {item.itemType}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-gray-700">{item.itemName}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-gray-700">{item.quantity.toLocaleString()}</td>
                    <td className="py-2 px-2 text-gray-600">{item.unit}</td>
                    <td className="py-2 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleEdit(item)}
                        className="text-xs text-accent-500 hover:text-accent-700 mr-2"
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Stats view */}
      {viewMode === "stats" && (
        statsData.length === 0 ? (
          <div className="text-center text-slate-400 mt-16 text-sm">
            {items.length === 0 ? "还没有添加任何物资记录" : "没有找到匹配的物资"}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {statsData.map((stat) => (
              <div
                key={`${stat.itemName}|${stat.unit}`}
                className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-800 text-sm">{stat.itemName}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">{stat.type}</span>
                </div>
                <div className="text-xs text-gray-500 mb-3">
                  总计: <span className="font-mono font-semibold text-gray-700">{stat.total.toLocaleString()}</span> {stat.unit}
                </div>
                <div className="space-y-1">
                  {stat.characters.map((ch) => (
                    <div key={ch.name} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">{ch.name}</span>
                      <span className="font-mono text-gray-700">{ch.quantity.toLocaleString()} {stat.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
