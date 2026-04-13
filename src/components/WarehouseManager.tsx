import { useState, useEffect, useMemo, useCallback } from "react";
import type { WarehouseItem, ItemType, ItemUnit } from "../lib/types";
import { loadWarehouseItems, saveWarehouseItems } from "../lib/storage";

const ITEM_TYPES: ItemType[] = ["食材", "木材", "花", "矿", "装备", "其他"];
const ITEM_UNITS: ItemUnit[] = ["个", "组", "箱"];
const DEFAULT_UNIT: ItemUnit = "箱";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

interface EditRow {
  id: string;
  itemType: ItemType;
  itemName: string;
  quantity: number;
  unit: ItemUnit;
}

// Confirm dialog component
function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm text-gray-700 mb-4">{message}</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">取消</button>
          <button type="button" onClick={onConfirm} className="px-4 py-1.5 rounded-lg text-xs font-medium bg-red-500 text-white hover:bg-red-600 transition-colors">确认删除</button>
        </div>
      </div>
    </div>
  );
}

export default function WarehouseManager() {
  const [items, setItems] = useState<WarehouseItem[]>(() => loadWarehouseItems());
  const [filterType, setFilterType] = useState<ItemType | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Character management
  const [showAddCharacter, setShowAddCharacter] = useState(false);
  const [newCharacterName, setNewCharacterName] = useState("");

  // Editing state
  const [editingCharacter, setEditingCharacter] = useState<string | null>(null);
  const [editRows, setEditRows] = useState<EditRow[]>([]);

  // Import/Export modal
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferText, setTransferText] = useState("");
  const [transferMode, setTransferMode] = useState<"export" | "import">("export");

  // Confirm dialog
  const [confirmAction, setConfirmAction] = useState<{ message: string; action: () => void } | null>(null);

  // Inline quantity editing in stats
  const [editingItemKey, setEditingItemKey] = useState<string | null>(null);

  useEffect(() => {
    saveWarehouseItems(items);
  }, [items]);

  const characterNames = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.characterName))).sort();
  }, [items]);

  const itemNames = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.itemName))).sort();
  }, [items]);

  // Items grouped by character
  const groupedByCharacter = useMemo(() => {
    const map = new Map<string, WarehouseItem[]>();
    for (const item of items) {
      if (!map.has(item.characterName)) map.set(item.characterName, []);
      map.get(item.characterName)!.push(item);
    }
    for (const [, arr] of map) {
      arr.sort((a, b) => a.itemType.localeCompare(b.itemType) || a.itemName.localeCompare(b.itemName));
    }
    return map;
  }, [items]);

  // Stats: group by item name, applying filters
  const statsData = useMemo(() => {
    const map = new Map<string, { type: ItemType; unit: ItemUnit; characters: { name: string; quantity: number; itemId: string }[]; total: number }>();
    for (const item of items) {
      const key = `${item.itemName}|${item.unit}`;
      if (!map.has(key)) {
        map.set(key, { type: item.itemType, unit: item.unit, characters: [], total: 0 });
      }
      const entry = map.get(key)!;
      entry.characters.push({ name: item.characterName, quantity: item.quantity, itemId: item.id });
      entry.total += item.quantity;
    }
    let result = Array.from(map.entries()).map(([key, val]) => ({
      key,
      itemName: key.split("|")[0],
      ...val,
      characters: val.characters.sort((a, b) => b.quantity - a.quantity),
    }));
    if (filterType) result = result.filter((i) => i.type === filterType);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((i) => i.itemName.toLowerCase().includes(q));
    }
    return result.sort((a, b) => a.type.localeCompare(b.type) || a.itemName.localeCompare(b.itemName));
  }, [items, filterType, searchQuery]);

  // --- Character actions ---
  const handleAddCharacter = useCallback(() => {
    const name = newCharacterName.trim();
    if (!name) return;
    setNewCharacterName("");
    setShowAddCharacter(false);
    if (characterNames.includes(name)) {
      // Already exists, just open editing
      startEditing(name, groupedByCharacter.get(name) || []);
      return;
    }
    startEditing(name, []);
  }, [newCharacterName, characterNames, groupedByCharacter]);

  const handleDeleteCharacter = useCallback((charName: string) => {
    setConfirmAction({
      message: `确认删除角色「${charName}」及其所有物资记录？`,
      action: () => {
        setItems((prev) => prev.filter((i) => i.characterName !== charName));
        if (editingCharacter === charName) { setEditingCharacter(null); setEditRows([]); }
        setConfirmAction(null);
      },
    });
  }, [editingCharacter]);

  // --- Batch editing ---
  const lastRowType = (rows: EditRow[]): ItemType => {
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].itemName.trim()) return rows[i].itemType;
    }
    return "食材";
  };

  const startEditing = useCallback((charName: string, existingItems: WarehouseItem[]) => {
    setEditingCharacter(charName);
    const rows: EditRow[] = existingItems.map((i) => ({
      id: i.id,
      itemType: i.itemType,
      itemName: i.itemName,
      quantity: i.quantity,
      unit: i.unit,
    }));
    const defaultType = rows.length > 0 ? rows[rows.length - 1].itemType : "食材";
    rows.push({ id: generateId(), itemType: defaultType, itemName: "", quantity: 1, unit: DEFAULT_UNIT });
    setEditRows(rows);
  }, []);

  const handleRowChange = useCallback((idx: number, field: keyof EditRow, value: any) => {
    setEditRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      if (idx === next.length - 1 && next[idx].itemName.trim()) {
        next.push({ id: generateId(), itemType: lastRowType(next), itemName: "", quantity: 1, unit: DEFAULT_UNIT });
      }
      return next;
    });
  }, []);

  const handleDeleteRow = useCallback((idx: number) => {
    setConfirmAction({
      message: `确认删除物资「${editRows[idx]?.itemName || ""}」？`,
      action: () => {
        setEditRows((prev) => {
          const next = prev.filter((_, i) => i !== idx);
          if (next.length === 0 || next[next.length - 1].itemName.trim()) {
            next.push({ id: generateId(), itemType: lastRowType(next), itemName: "", quantity: 1, unit: DEFAULT_UNIT });
          }
          return next;
        });
        setConfirmAction(null);
      },
    });
  }, [editRows]);

  const handleSaveEditing = useCallback(() => {
    if (!editingCharacter) return;
    const charName = editingCharacter;
    const validRows = editRows.filter((r) => r.itemName.trim() && r.quantity > 0);
    setItems((prev) => {
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

  // --- Inline quantity edit from stats ---
  const handleInlineQuantityChange = useCallback((itemId: string, newQty: number) => {
    setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, quantity: Math.max(0, newQty) } : i));
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

  // Filter character list for display
  const filteredCharacters = useMemo(() => {
    return characterNames.filter((name) => {
      const charItems = groupedByCharacter.get(name) || [];
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        if (!name.toLowerCase().includes(q) && !charItems.some((i) => i.itemName.toLowerCase().includes(q))) return false;
      }
      if (filterType && !charItems.some((i) => i.itemType === filterType)) return false;
      return true;
    });
  }, [characterNames, groupedByCharacter, searchQuery, filterType]);

  return (
    <div>
      {/* Data warning */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 text-xs text-amber-700">
        数据完全存储在本地浏览器中，清理浏览器记录会导致数据丢失。建议定期导出备份。
      </div>

      {/* Import/Export buttons */}
      <div className="flex gap-2 mb-4">
        <button type="button" onClick={handleOpenExport} disabled={items.length === 0}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          导出数据
        </button>
        <button type="button" onClick={handleOpenImport}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
          导入数据
        </button>
      </div>

      {/* Confirm dialog */}
      {confirmAction && (
        <ConfirmDialog message={confirmAction.message} onConfirm={confirmAction.action} onCancel={() => setConfirmAction(null)} />
      )}

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
                <textarea readOnly value={transferText}
                  className="w-full h-32 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-600 resize-none focus:outline-none"
                  onFocus={(e) => e.target.select()} />
                <div className="flex justify-end gap-2 mt-3">
                  <button type="button" onClick={() => setShowTransfer(false)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">关闭</button>
                  <button type="button" onClick={handleCopyExport} className="px-4 py-1.5 rounded-lg text-xs font-medium bg-accent-500 text-white hover:bg-accent-600 transition-colors">复制</button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-gray-500 mb-2">粘贴从其他人处获得的数据文本，导入后将追加到现有数据中。</p>
                <textarea value={transferText} onChange={(e) => setTransferText(e.target.value)} placeholder="在此粘贴数据..."
                  className="w-full h-32 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-600 resize-none focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500" />
                <div className="flex justify-end gap-2 mt-3">
                  <button type="button" onClick={() => setShowTransfer(false)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">取消</button>
                  <button type="button" onClick={handleImportConfirm} disabled={!transferText.trim()}
                    className="px-4 py-1.5 rounded-lg text-xs font-medium bg-accent-500 text-white hover:bg-accent-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    导入
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Filters + add character */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input type="text" placeholder="搜索物资或角色..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          className="w-48 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500" />
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          <button type="button" onClick={() => setFilterType(null)}
            className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all duration-150 ${filterType === null ? pillActive : pillInactive}`}>
            全部
          </button>
          {ITEM_TYPES.map((t) => (
            <button key={t} type="button" onClick={() => setFilterType(t === filterType ? null : t)}
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all duration-150 ${filterType === t ? pillActive : pillInactive}`}>
              {t}
            </button>
          ))}
        </div>
        {showAddCharacter ? (
          <div className="ml-auto flex items-center gap-2">
            <input type="text" value={newCharacterName} onChange={(e) => setNewCharacterName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddCharacter(); if (e.key === "Escape") { setShowAddCharacter(false); setNewCharacterName(""); } }}
              placeholder="输入角色名..." autoFocus
              className="w-32 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500" />
            <button type="button" onClick={handleAddCharacter} disabled={!newCharacterName.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent-500 text-white shadow-sm hover:bg-accent-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              确定
            </button>
            <button type="button" onClick={() => { setShowAddCharacter(false); setNewCharacterName(""); }}
              className="px-2 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
              取消
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setShowAddCharacter(true)}
            className="ml-auto px-3.5 py-1.5 rounded-lg text-xs font-medium bg-accent-500 text-white shadow-sm hover:bg-accent-600 transition-colors">
            + 添加角色
          </button>
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
                      <select value={row.itemType} onChange={(e) => handleRowChange(idx, "itemType", e.target.value)}
                        className={selectCls + " w-full text-xs py-1"}>
                        {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 px-2">
                      <input type="text" value={row.itemName} onChange={(e) => handleRowChange(idx, "itemName", e.target.value)}
                        list="wh-item-list" placeholder={idx === editRows.length - 1 ? "输入物资名称添加新行..." : "物资名称"}
                        className={inputCls + " text-xs py-1"} />
                    </td>
                    <td className="py-1.5 px-2">
                      <input type="number" value={row.quantity} onChange={(e) => handleRowChange(idx, "quantity", Number(e.target.value) || 0)}
                        min={0} className={inputCls + " text-xs py-1 text-right"} />
                    </td>
                    <td className="py-1.5 px-2">
                      <select value={row.unit} onChange={(e) => handleRowChange(idx, "unit", e.target.value)}
                        className={selectCls + " w-full text-xs py-1"}>
                        {ITEM_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      {!(idx === editRows.length - 1 && !row.itemName.trim()) && (
                        <button type="button" onClick={() => handleDeleteRow(idx)} className="text-xs text-red-400 hover:text-red-600">
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

      {/* === Unified view: Character cards + Stats === */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left: Character cards */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 mb-3">角色仓库</h2>
          {filteredCharacters.length === 0 && editingCharacter === null ? (
            <div className="text-center text-slate-400 mt-8 text-sm">
              {items.length === 0 ? '点击右上角"+ 添加角色"开始记录物资' : "没有找到匹配的记录"}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCharacters.map((charName) => {
                let charItems = groupedByCharacter.get(charName) || [];
                if (filterType) charItems = charItems.filter((i) => i.itemType === filterType);
                if (searchQuery.trim()) {
                  const q = searchQuery.trim().toLowerCase();
                  charItems = charItems.filter((i) => i.itemName.toLowerCase().includes(q));
                }
                if (editingCharacter === charName) return null;
                return (
                  <div key={charName} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
                      <span className="font-semibold text-gray-800 text-sm">{charName}</span>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => startEditing(charName, groupedByCharacter.get(charName) || [])}
                          className="text-xs text-accent-500 hover:text-accent-700 font-medium">编辑</button>
                        <button type="button" onClick={() => handleDeleteCharacter(charName)}
                          className="text-xs text-red-400 hover:text-red-600 font-medium">删除</button>
                      </div>
                    </div>
                    {charItems.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-gray-400">暂无物资，点击编辑添加</div>
                    ) : (
                      <table className="w-full text-sm border-collapse">
                        <tbody>
                          {charItems.map((item) => (
                            <tr key={item.id} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50">
                              <td className="py-1.5 px-4">
                                <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">{item.itemType}</span>
                              </td>
                              <td className="py-1.5 px-2 text-gray-700 text-sm">{item.itemName}</td>
                              <td className="py-1.5 px-2 text-right tabular-nums text-gray-700 text-sm">{item.quantity.toLocaleString()}</td>
                              <td className="py-1.5 px-2 text-gray-500 text-xs">{item.unit}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Stats summary with inline editing */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 mb-3">物资统计</h2>
          {statsData.length === 0 ? (
            <div className="text-center text-slate-400 mt-8 text-sm">
              {items.length === 0 ? "添加物资后这里会显示统计" : "没有找到匹配的物资"}
            </div>
          ) : (
            <div className="space-y-3">
              {statsData.map((stat) => {
                const isExpanded = editingItemKey === stat.key;
                return (
                  <div key={stat.key} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <div
                      className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => setEditingItemKey(isExpanded ? null : stat.key)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-800 text-sm">{stat.itemName}</span>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">{stat.type}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-gray-700 text-sm">{stat.total.toLocaleString()}</span>
                        <span className="text-xs text-gray-500">{stat.unit}</span>
                        <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="border-t border-gray-100 px-4 py-2 space-y-1.5">
                        {stat.characters.map((ch) => (
                          <div key={ch.itemId} className="flex items-center justify-between gap-2">
                            <span className="text-xs text-gray-600 min-w-0 truncate">{ch.name}</span>
                            <div className="flex items-center gap-1">
                              <button type="button"
                                onClick={() => handleInlineQuantityChange(ch.itemId, ch.quantity - 1)}
                                className="w-6 h-6 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 text-xs font-bold flex items-center justify-center">
                                -
                              </button>
                              <input type="number" value={ch.quantity}
                                onChange={(e) => handleInlineQuantityChange(ch.itemId, Number(e.target.value) || 0)}
                                className="w-16 text-center text-xs font-mono bg-white border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-accent-500/30" />
                              <button type="button"
                                onClick={() => handleInlineQuantityChange(ch.itemId, ch.quantity + 1)}
                                className="w-6 h-6 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 text-xs font-bold flex items-center justify-center">
                                +
                              </button>
                              <span className="text-xs text-gray-400 ml-0.5">{stat.unit}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
