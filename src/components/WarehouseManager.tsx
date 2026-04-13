import { useState, useEffect, useMemo, useCallback } from "react";
import type { WarehouseItem, ItemType, ItemUnit } from "../lib/types";
import { loadWarehouseItems, saveWarehouseItems } from "../lib/storage";

const ITEM_TYPES: ItemType[] = ["食材", "木材", "花", "矿", "装备", "其他"];
const ITEM_UNITS: ItemUnit[] = ["个", "组", "箱"];

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

type ViewMode = "list" | "stats";

interface EditRow {
  id: string;
  itemType: ItemType;
  itemName: string;
  quantity: number;
  unit: ItemUnit;
  isNew?: boolean;
}

export default function WarehouseManager() {
  const [items, setItems] = useState<WarehouseItem[]>(() => loadWarehouseItems());
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [filterType, setFilterType] = useState<ItemType | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Character management
  const [showAddCharacter, setShowAddCharacter] = useState(false);
  const [newCharacterName, setNewCharacterName] = useState("");

  // Editing state: which character is being batch-edited
  const [editingCharacter, setEditingCharacter] = useState<string | null>(null);
  const [editRows, setEditRows] = useState<EditRow[]>([]);

  // Import/Export modal
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferText, setTransferText] = useState("");
  const [transferMode, setTransferMode] = useState<"export" | "import">("export");

  useEffect(() => {
    saveWarehouseItems(items);
  }, [items]);

  // Unique character names
  const characterNames = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.characterName))).sort();
  }, [items]);

  // Unique item names for autocomplete
  const itemNames = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.itemName))).sort();
  }, [items]);

  // Items grouped by character for list view
  const groupedByCharacter = useMemo(() => {
    let filtered = items;
    if (filterType) filtered = filtered.filter((i) => i.itemType === filterType);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(
        (i) => i.itemName.toLowerCase().includes(q) || i.characterName.toLowerCase().includes(q)
      );
    }
    const map = new Map<string, WarehouseItem[]>();
    for (const item of filtered) {
      if (!map.has(item.characterName)) map.set(item.characterName, []);
      map.get(item.characterName)!.push(item);
    }
    // Sort items within each character
    for (const [, arr] of map) {
      arr.sort((a, b) => a.itemType.localeCompare(b.itemType) || a.itemName.localeCompare(b.itemName));
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
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
    if (filterType) result = result.filter((i) => i.type === filterType);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((i) => i.itemName.toLowerCase().includes(q));
    }
    return result.sort((a, b) => a.itemName.localeCompare(b.itemName));
  }, [items, filterType, searchQuery]);

  // --- Character actions ---
  const handleAddCharacter = useCallback(() => {
    const name = newCharacterName.trim();
    if (!name) return;
    if (characterNames.includes(name)) { setNewCharacterName(""); setShowAddCharacter(false); return; }
    // Add an empty placeholder so the character shows up; start editing immediately
    setNewCharacterName("");
    setShowAddCharacter(false);
    startEditing(name, []);
  }, [newCharacterName, characterNames]);

  const handleDeleteCharacter = useCallback((charName: string) => {
    setItems((prev) => prev.filter((i) => i.characterName !== charName));
    if (editingCharacter === charName) { setEditingCharacter(null); setEditRows([]); }
  }, [editingCharacter]);

  // --- Batch editing ---
  const startEditing = useCallback((charName: string, existingItems: WarehouseItem[]) => {
    setEditingCharacter(charName);
    const rows: EditRow[] = existingItems.map((i) => ({
      id: i.id,
      itemType: i.itemType,
      itemName: i.itemName,
      quantity: i.quantity,
      unit: i.unit,
    }));
    // Always add one empty row at the end
    rows.push({ id: generateId(), itemType: "食材", itemName: "", quantity: 1, unit: "个", isNew: true });
    setEditRows(rows);
  }, []);

  const handleRowChange = useCallback((idx: number, field: keyof EditRow, value: any) => {
    setEditRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      // If editing the last row (the empty one), auto-add another empty row
      if (idx === next.length - 1 && next[idx].itemName.trim()) {
        next.push({ id: generateId(), itemType: "食材", itemName: "", quantity: 1, unit: "个", isNew: true });
      }
      return next;
    });
  }, []);

  const handleDeleteRow = useCallback((idx: number) => {
    setEditRows((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      // Ensure at least one empty row
      if (next.length === 0 || next[next.length - 1].itemName.trim()) {
        next.push({ id: generateId(), itemType: "食材", itemName: "", quantity: 1, unit: "个", isNew: true });
      }
      return next;
    });
  }, []);

  const handleSaveEditing = useCallback(() => {
    if (!editingCharacter) return;
    const charName = editingCharacter;
    // Filter out empty rows
    const validRows = editRows.filter((r) => r.itemName.trim() && r.quantity > 0);
    setItems((prev) => {
      // Remove all items for this character, then add new ones
      const others = prev.filter((i) => i.characterName !== charName);
      const newItems: WarehouseItem[] = validRows.map((r) => ({
        id: r.id,
        characterName: charName,
        itemType: r.itemType,
        itemName: r.itemName.trim(),
        quantity: r.quantity,
        unit: r.unit,
      }));
      return [...others, ...newItems];
    });
    setEditingCharacter(null);
    setEditRows([]);
  }, [editingCharacter, editRows]);

  const handleCancelEditing = useCallback(() => {
    setEditingCharacter(null);
    setEditRows([]);
  }, []);

  // --- Import/Export via base64 ---
  const handleOpenExport = useCallback(() => {
    const json = JSON.stringify(items);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    setTransferText(b64);
    setTransferMode("export");
    setShowTransfer(true);
  }, [items]);

  const handleOpenImport = useCallback(() => {
    setTransferText("");
    setTransferMode("import");
    setShowTransfer(true);
  }, []);

  const handleImportConfirm = useCallback(() => {
    try {
      const json = decodeURIComponent(escape(atob(transferText.trim())));
      const data = JSON.parse(json);
      if (!Array.isArray(data)) { alert("无效的数据格式"); return; }
      const imported: WarehouseItem[] = data
        .filter((d: any) => d.characterName && d.itemName && d.itemType && d.quantity && d.unit)
        .map((d: any) => ({ ...d, id: generateId() }));
      if (imported.length === 0) { alert("未找到有效的物资记录"); return; }
      setItems((prev) => [...prev, ...imported]);
      setShowTransfer(false);
      setTransferText("");
    } catch {
      alert("数据解析失败，请确认粘贴的内容正确");
    }
  }, [transferText]);

  const handleCopyExport = useCallback(() => {
    navigator.clipboard.writeText(transferText).then(() => {
      alert("已复制到剪贴板");
    });
  }, [transferText]);

  const inputCls = "w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500";
  const selectCls = "bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500";
  const pillActive = "bg-accent-500 text-white shadow-sm shadow-accent-500/20";
  const pillInactive = "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900";

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
              viewMode === tab.id ? pillActive : pillInactive
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

      {/* Import/Export buttons */}
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={handleOpenExport}
          disabled={items.length === 0}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          导出数据
        </button>
        <button
          type="button"
          onClick={handleOpenImport}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
        >
          导入数据
        </button>
      </div>

      {/* Transfer modal */}
      {showTransfer && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowTransfer(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-800 mb-3">
              {transferMode === "export" ? "导出数据" : "导入数据"}
            </h3>
            {transferMode === "export" ? (
              <>
                <p className="text-xs text-gray-500 mb-2">复制下方文本，通过聊天工具发送给其他人即可分享数据。</p>
                <textarea
                  readOnly
                  value={transferText}
                  className="w-full h-32 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-600 resize-none focus:outline-none"
                  onFocus={(e) => e.target.select()}
                />
                <div className="flex justify-end gap-2 mt-3">
                  <button type="button" onClick={() => setShowTransfer(false)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">关闭</button>
                  <button type="button" onClick={handleCopyExport} className="px-4 py-1.5 rounded-lg text-xs font-medium bg-accent-500 text-white hover:bg-accent-600 transition-colors">复制</button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-gray-500 mb-2">粘贴从其他人处获得的数据文本，导入后将追加到现有数据中。</p>
                <textarea
                  value={transferText}
                  onChange={(e) => setTransferText(e.target.value)}
                  placeholder="在此粘贴数据..."
                  className="w-full h-32 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-600 resize-none focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
                />
                <div className="flex justify-end gap-2 mt-3">
                  <button type="button" onClick={() => setShowTransfer(false)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">取消</button>
                  <button
                    type="button"
                    onClick={handleImportConfirm}
                    disabled={!transferText.trim()}
                    className="px-4 py-1.5 rounded-lg text-xs font-medium bg-accent-500 text-white hover:bg-accent-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    导入
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

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
              filterType === null ? pillActive : pillInactive
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
                filterType === t ? pillActive : pillInactive
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        {viewMode === "list" && (
          showAddCharacter ? (
            <div className="ml-auto flex items-center gap-2">
              <input
                type="text"
                value={newCharacterName}
                onChange={(e) => setNewCharacterName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddCharacter(); if (e.key === "Escape") { setShowAddCharacter(false); setNewCharacterName(""); } }}
                placeholder="输入角色名..."
                autoFocus
                className="w-32 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
              />
              <button
                type="button"
                onClick={handleAddCharacter}
                disabled={!newCharacterName.trim()}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent-500 text-white shadow-sm hover:bg-accent-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                确定
              </button>
              <button
                type="button"
                onClick={() => { setShowAddCharacter(false); setNewCharacterName(""); }}
                className="px-2 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddCharacter(true)}
              className="ml-auto px-3.5 py-1.5 rounded-lg text-xs font-medium bg-accent-500 text-white shadow-sm hover:bg-accent-600 transition-colors"
            >
              + 添加角色
            </button>
          )
        )}
      </div>

      {/* Batch editing panel */}
      {editingCharacter !== null && (
        <div className="bg-white border border-accent-200 rounded-xl p-4 mb-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">
              编辑 <span className="text-accent-600">{editingCharacter}</span> 的物资
            </h3>
            <div className="flex gap-2">
              <button type="button" onClick={handleCancelEditing} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">取消</button>
              <button type="button" onClick={handleSaveEditing} className="px-4 py-1.5 rounded-lg text-xs font-medium bg-accent-500 text-white hover:bg-accent-600 transition-colors">保存全部</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-gray-500 text-xs border-b border-gray-200">
                  <th className="py-2 px-2 font-medium w-28">类型</th>
                  <th className="py-2 px-2 font-medium">名称</th>
                  <th className="py-2 px-2 font-medium w-24 text-right">数量</th>
                  <th className="py-2 px-2 font-medium w-20">单位</th>
                  <th className="py-2 px-2 font-medium w-12 text-center">操作</th>
                </tr>
              </thead>
              <tbody>
                {editRows.map((row, idx) => (
                  <tr key={row.id} className="border-b border-gray-50">
                    <td className="py-1.5 px-2">
                      <select
                        value={row.itemType}
                        onChange={(e) => handleRowChange(idx, "itemType", e.target.value)}
                        className={selectCls + " w-full text-xs py-1"}
                      >
                        {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 px-2">
                      <input
                        type="text"
                        value={row.itemName}
                        onChange={(e) => handleRowChange(idx, "itemName", e.target.value)}
                        list="wh-item-list"
                        placeholder={idx === editRows.length - 1 ? "输入物资名称添加新行..." : "物资名称"}
                        className={inputCls + " text-xs py-1"}
                      />
                    </td>
                    <td className="py-1.5 px-2">
                      <input
                        type="number"
                        value={row.quantity}
                        onChange={(e) => handleRowChange(idx, "quantity", Number(e.target.value) || 0)}
                        min={0}
                        className={inputCls + " text-xs py-1 text-right"}
                      />
                    </td>
                    <td className="py-1.5 px-2">
                      <select
                        value={row.unit}
                        onChange={(e) => handleRowChange(idx, "unit", e.target.value)}
                        className={selectCls + " w-full text-xs py-1"}
                      >
                        {ITEM_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      {/* Don't show delete for the trailing empty row */}
                      {!(idx === editRows.length - 1 && !row.itemName.trim()) && (
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(idx)}
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          删除
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <datalist id="wh-item-list">
              {itemNames.map((n) => <option key={n} value={n} />)}
            </datalist>
          </div>
        </div>
      )}

      {/* List view: grouped by character */}
      {viewMode === "list" && editingCharacter === null && (
        groupedByCharacter.length === 0 ? (
          <div className="text-center text-slate-400 mt-16 text-sm">
            {items.length === 0 ? '点击右上角"+ 添加角色"开始记录物资' : "没有找到匹配的记录"}
          </div>
        ) : (
          <div className="space-y-4">
            {groupedByCharacter.map(([charName, charItems]) => (
              <div key={charName} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                  <span className="font-semibold text-gray-800 text-sm">{charName}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEditing(charName, charItems)}
                      className="text-xs text-accent-500 hover:text-accent-700 font-medium"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCharacter(charName)}
                      className="text-xs text-red-400 hover:text-red-600 font-medium"
                    >
                      删除角色
                    </button>
                  </div>
                </div>
                {charItems.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-gray-400">暂无物资，点击编辑添加</div>
                ) : (
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="text-left text-gray-500 text-xs border-b border-gray-100">
                        <th className="py-1.5 px-4 font-medium">类型</th>
                        <th className="py-1.5 px-2 font-medium">名称</th>
                        <th className="py-1.5 px-2 font-medium text-right">数量</th>
                        <th className="py-1.5 px-2 font-medium">单位</th>
                      </tr>
                    </thead>
                    <tbody>
                      {charItems.map((item) => (
                        <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-1.5 px-4">
                            <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">{item.itemType}</span>
                          </td>
                          <td className="py-1.5 px-2 text-gray-700">{item.itemName}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums text-gray-700">{item.quantity.toLocaleString()}</td>
                          <td className="py-1.5 px-2 text-gray-600">{item.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
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
