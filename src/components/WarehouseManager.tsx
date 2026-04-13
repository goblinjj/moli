import { useState, useEffect, useMemo, useCallback } from "react";
import type { WarehouseItem, ItemType, ItemUnit, CharacterConfig } from "../lib/types";
import { loadWarehouseItems, saveWarehouseItems, loadCharacterConfigs, saveCharacterConfigs } from "../lib/storage";

const ITEM_TYPES: ItemType[] = ["食材", "木材", "花", "矿", "装备", "其他"];
const ITEM_UNITS: ItemUnit[] = ["个", "组", "箱"];
const DEFAULT_UNIT: ItemUnit = "箱";
const DEFAULT_TOTAL_SLOTS = 40;

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

interface EditRow {
  id: string;
  itemType: ItemType;
  itemName: string;
  quantity: number;
  unit: ItemUnit;
  slots: number;
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
  const [charConfigs, setCharConfigs] = useState<CharacterConfig[]>(() => loadCharacterConfigs());
  const [filterType, setFilterType] = useState<ItemType | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Character management
  const [showAddCharacter, setShowAddCharacter] = useState(false);
  const [newCharacterName, setNewCharacterName] = useState("");

  // Editing state
  const [editingCharacter, setEditingCharacter] = useState<string | null>(null);
  const [editRows, setEditRows] = useState<EditRow[]>([]);
  const [editTotalSlots, setEditTotalSlots] = useState(DEFAULT_TOTAL_SLOTS);

  // Import/Export modal
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferText, setTransferText] = useState("");
  const [transferMode, setTransferMode] = useState<"export" | "import">("export");

  // Confirm dialog
  const [confirmAction, setConfirmAction] = useState<{ message: string; action: () => void } | null>(null);

  // Inline quantity editing in stats
  const [editingItemKey, setEditingItemKey] = useState<string | null>(null);

  // Expanded character card
  const [expandedCharacter, setExpandedCharacter] = useState<string | null>(null);

  useEffect(() => {
    saveWarehouseItems(items);
  }, [items]);

  useEffect(() => {
    saveCharacterConfigs(charConfigs);
  }, [charConfigs]);

  const getCharTotalSlots = useCallback((charName: string) => {
    return charConfigs.find((c) => c.name === charName)?.totalSlots ?? DEFAULT_TOTAL_SLOTS;
  }, [charConfigs]);

  const getCharUsedSlots = useCallback((charName: string) => {
    return items.filter((i) => i.characterName === charName).reduce((sum, i) => sum + i.slots, 0);
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
    return result.sort((a, b) => a.itemName.localeCompare(b.itemName));
  }, [items, filterType, searchQuery]);

  // Stats grouped by type
  const statsGroupedByType = useMemo(() => {
    const map = new Map<ItemType, typeof statsData>();
    for (const stat of statsData) {
      if (!map.has(stat.type)) map.set(stat.type, []);
      map.get(stat.type)!.push(stat);
    }
    return ITEM_TYPES.filter((t) => map.has(t)).map((t) => ({ type: t, items: map.get(t)! }));
  }, [statsData]);

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
        setCharConfigs((prev) => prev.filter((c) => c.name !== charName));
        if (editingCharacter === charName) { setEditingCharacter(null); setEditRows([]); }
        if (expandedCharacter === charName) setExpandedCharacter(null);
        setConfirmAction(null);
      },
    });
  }, [editingCharacter]);

  // --- Batch editing ---
  const lastRowDefaults = (rows: EditRow[]): { type: ItemType; unit: ItemUnit } => {
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].itemName.trim()) return { type: rows[i].itemType, unit: rows[i].unit };
    }
    return { type: "食材", unit: DEFAULT_UNIT };
  };

  const startEditing = useCallback((charName: string, existingItems: WarehouseItem[]) => {
    setEditingCharacter(charName);
    setEditTotalSlots(getCharTotalSlots(charName));
    const rows: EditRow[] = existingItems.map((i) => ({
      id: i.id,
      itemType: i.itemType,
      itemName: i.itemName,
      quantity: i.quantity,
      unit: i.unit,
      slots: i.slots,
    }));
    const defaults = lastRowDefaults(rows);
    rows.push({ id: generateId(), itemType: defaults.type, itemName: "", quantity: 1, unit: defaults.unit, slots: 1 });
    setEditRows(rows);
  }, [getCharTotalSlots]);

  const handleRowChange = useCallback((idx: number, field: keyof EditRow, value: any) => {
    setEditRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      // Auto-update slots when quantity changes (only if slots wasn't manually set differently)
      if (field === "quantity") {
        next[idx] = { ...next[idx], slots: Math.ceil(Number(value) || 0) };
      }
      if (idx === next.length - 1 && next[idx].itemName.trim()) {
        const d = lastRowDefaults(next);
        next.push({ id: generateId(), itemType: d.type, itemName: "", quantity: 1, unit: d.unit, slots: 1 });
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
            const d = lastRowDefaults(next);
            next.push({ id: generateId(), itemType: d.type, itemName: "", quantity: 1, unit: d.unit, slots: 1 });
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
        slots: r.slots,
      }));
      return [...others, ...newItems];
    });
    // Save character slot config
    setCharConfigs((prev) => {
      const others = prev.filter((c) => c.name !== charName);
      return [...others, { name: charName, totalSlots: editTotalSlots }];
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
    const json = JSON.stringify({ items, charConfigs });
    const b64 = btoa(unescape(encodeURIComponent(json)));
    setTransferText(b64);
    setTransferMode("export");
    setShowTransfer(true);
  }, [items, charConfigs]);

  const handleOpenImport = useCallback(() => {
    setTransferText("");
    setTransferMode("import");
    setShowTransfer(true);
  }, []);

  const handleImportConfirm = useCallback(() => {
    try {
      const json = decodeURIComponent(escape(atob(transferText.trim())));
      const parsed = JSON.parse(json);
      // Support both old format (array) and new format ({items, charConfigs})
      const rawItems = Array.isArray(parsed) ? parsed : parsed.items;
      const rawConfigs: CharacterConfig[] = Array.isArray(parsed) ? [] : (parsed.charConfigs || []);
      if (!Array.isArray(rawItems)) { alert("无效的数据格式"); return; }
      const imported: WarehouseItem[] = rawItems
        .filter((d: any) => d.characterName && d.itemName && d.itemType && d.quantity && d.unit)
        .map((d: any) => ({ ...d, id: generateId(), slots: d.slots ?? Math.ceil(d.quantity) }));
      if (imported.length === 0) { alert("未找到有效的物资记录"); return; }
      setItems((prev) => [...prev, ...imported]);
      if (rawConfigs.length > 0) {
        setCharConfigs((prev) => {
          const existing = new Set(prev.map((c) => c.name));
          return [...prev, ...rawConfigs.filter((c: CharacterConfig) => !existing.has(c.name))];
        });
      }
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
      {editingCharacter !== null && (() => {
        const usedSlots = editRows.filter((r) => r.itemName.trim() && r.quantity > 0).reduce((s, r) => s + r.slots, 0);
        return (
        <div className="bg-white border border-accent-200 rounded-xl p-4 mb-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-gray-800">
                编辑 <span className="text-accent-600">{editingCharacter}</span> 的物资
              </h3>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <span className={`font-mono font-semibold ${usedSlots > editTotalSlots ? "text-red-500" : "text-gray-700"}`}>{usedSlots}</span>
                <span>/</span>
                <input type="number" value={editTotalSlots} onChange={(e) => setEditTotalSlots(Number(e.target.value) || DEFAULT_TOTAL_SLOTS)}
                  min={1} className="w-10 text-center font-mono font-semibold bg-white border border-gray-200 rounded px-1 py-0 text-xs focus:outline-none focus:ring-1 focus:ring-accent-500/30" />
                <span>格</span>
              </div>
            </div>
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
                  <th className="py-2 px-2 font-medium w-16 text-right">占格</th>
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
                    <td className="py-1.5 px-2">
                      <input type="number" value={row.slots}
                        onChange={(e) => { setEditRows((prev) => { const next = [...prev]; next[idx] = { ...next[idx], slots: Number(e.target.value) || 0 }; return next; }); }}
                        min={0} className={inputCls + " text-xs py-1 text-right"} />
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
        );
      })()}

      {/* === Character tags === */}
      <h2 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">角色仓库</h2>
      {filteredCharacters.length === 0 && editingCharacter === null ? (
        <div className="text-center text-slate-400 py-3 text-xs">
          {items.length === 0 ? '点击"+ 添加角色"开始' : "没有匹配的记录"}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1 mb-2">
          {filteredCharacters.map((charName) => {
            if (editingCharacter === charName) return null;
            const used = getCharUsedSlots(charName);
            const total = getCharTotalSlots(charName);
            const isExpanded = expandedCharacter === charName;
            const isFull = used >= total;
            return (
              <button key={charName} type="button"
                onClick={() => setExpandedCharacter(isExpanded ? null : charName)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  isExpanded ? "bg-accent-500 text-white" : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}>
                <span>{charName}</span>
                <span className={`text-[10px] font-mono ${
                  isExpanded ? "text-white/70" : isFull ? "text-red-400" : "text-gray-400"
                }`}>{used}/{total}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Expanded character detail */}
      {expandedCharacter && editingCharacter === null && (() => {
        let charItems = groupedByCharacter.get(expandedCharacter) || [];
        if (filterType) charItems = charItems.filter((i) => i.itemType === filterType);
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          charItems = charItems.filter((i) => i.itemName.toLowerCase().includes(q));
        }
        const used = getCharUsedSlots(expandedCharacter);
        const total = getCharTotalSlots(expandedCharacter);
        return (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm mb-4 overflow-hidden">
            <div className="flex items-center justify-between px-2.5 py-1.5 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-800 text-xs">{expandedCharacter}</span>
                <span className={`text-[10px] font-mono ${used >= total ? "text-red-400" : "text-gray-400"}`}>{used}/{total}格</span>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => { startEditing(expandedCharacter, groupedByCharacter.get(expandedCharacter) || []); setExpandedCharacter(null); }}
                  className="text-[10px] text-accent-500 hover:text-accent-700 font-medium">编辑</button>
                <button type="button" onClick={() => handleDeleteCharacter(expandedCharacter)}
                  className="text-[10px] text-red-400 hover:text-red-600 font-medium">删除角色</button>
              </div>
            </div>
            {charItems.length === 0 ? (
              <div className="px-2.5 py-2 text-[10px] text-gray-400">暂无物资，点击编辑添加</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 px-2.5 py-1">
                {charItems.map((item) => (
                  <div key={item.id} className="flex items-baseline py-[1px] text-[11px] leading-tight">
                    <span className="text-gray-700 min-w-0 truncate">{item.itemName}</span>
                    <span className="tabular-nums text-gray-500 ml-auto pl-1 flex-shrink-0">{item.quantity}{item.unit}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* === Stats by category === */}
      <h2 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">物资统计</h2>
      {statsGroupedByType.length === 0 ? (
        <div className="text-center text-slate-400 py-3 text-xs">
          {items.length === 0 ? "添加物资后显示统计" : "没有匹配的物资"}
        </div>
      ) : (
        <div className="space-y-3">
          {statsGroupedByType.map(({ type, items: typeItems }) => (
            <div key={type}>
              <h3 className="text-[11px] font-semibold text-gray-500 mb-1">{type}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5">
                {typeItems.map((stat) => {
                  const isExpanded = editingItemKey === stat.key;
                  return (
                    <div key={stat.key} className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
                      <div
                        className="flex items-baseline justify-between px-2 py-1 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => setEditingItemKey(isExpanded ? null : stat.key)}
                      >
                        <span className="text-gray-800 text-[11px] font-medium min-w-0 truncate">{stat.itemName}</span>
                        <span className="tabular-nums font-semibold text-gray-600 text-[11px] ml-1 flex-shrink-0">{stat.total}{stat.unit}</span>
                      </div>
                      {isExpanded && (
                        <div className="border-t border-gray-100 px-2 py-1 space-y-0.5 bg-gray-50/50">
                          {stat.characters.map((ch) => (
                            <div key={ch.itemId} className="flex items-center gap-1">
                              <span className="text-[10px] text-gray-500 min-w-0 truncate flex-1">{ch.name}</span>
                              <button type="button"
                                onClick={() => handleInlineQuantityChange(ch.itemId, ch.quantity - 1)}
                                className="w-4 h-4 rounded bg-gray-200/80 text-gray-500 hover:bg-gray-300 text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                                -
                              </button>
                              <input type="number" value={ch.quantity}
                                onChange={(e) => handleInlineQuantityChange(ch.itemId, Number(e.target.value) || 0)}
                                className="w-10 text-center text-[10px] font-mono bg-white border border-gray-200 rounded px-0.5 py-0 focus:outline-none focus:ring-1 focus:ring-accent-500/30" />
                              <button type="button"
                                onClick={() => handleInlineQuantityChange(ch.itemId, ch.quantity + 1)}
                                className="w-4 h-4 rounded bg-gray-200/80 text-gray-500 hover:bg-gray-300 text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                                +
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
