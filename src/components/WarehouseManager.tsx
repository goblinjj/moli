import { useState, useEffect, useMemo, useCallback } from "react";
import type { Recipe, WarehouseItem, ItemType, ItemUnit, CharacterConfig, Category } from "../lib/types";
import { loadWarehouseItems, saveWarehouseItems, loadCharacterConfigs, saveCharacterConfigs } from "../lib/storage";
import { simplifiedToTraditional, traditionalToSimplified } from "../lib/zhConvert";

const ITEM_TYPES: ItemType[] = ["食材", "木材", "花", "矿", "装备", "其他"];
const ITEM_UNITS: ItemUnit[] = ["个", "组", "箱"];
const DEFAULT_UNIT: ItemUnit = "箱";
const DEFAULT_TOTAL_SLOTS = 80;

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

interface MaterialInfo {
  name: string;
  image: string;
  simplifiedName: string;
}

interface EditRow {
  id: string;
  itemType: ItemType;
  itemName: string;
  quantity: number;
  unit: ItemUnit;
  slots: number;
  materialImage?: string;
}

interface WarehouseManagerProps {
  recipes: Recipe[];
}

const RECIPE_GROUPS: { group: string; categories: { id: Category; label: string }[] }[] = [
  {
    group: "武器",
    categories: [
      { id: "sword", label: "铸剑" }, { id: "axe", label: "造斧" },
      { id: "spear", label: "造枪" }, { id: "bow", label: "造弓" },
      { id: "staff", label: "造杖" }, { id: "dagger", label: "小刀" },
      { id: "throw", label: "投掷" }, { id: "bomb", label: "炸弹" },
    ],
  },
  {
    group: "防具",
    categories: [
      { id: "helmet", label: "头盔" }, { id: "hat", label: "帽子" },
      { id: "armor", label: "铠甲" }, { id: "cloth", label: "衣服" },
      { id: "robe", label: "长袍" }, { id: "boots", label: "靴子" },
      { id: "shoes", label: "鞋子" }, { id: "shield", label: "盾牌" },
    ],
  },
  {
    group: "补给",
    categories: [
      { id: "cooking", label: "料理" }, { id: "pharmacy", label: "药品" },
    ],
  },
  {
    group: "其他",
    categories: [
      { id: "accessory", label: "饰品" }, { id: "dragon", label: "水龙" },
      { id: "fiveC", label: "5C" }, { id: "scroll", label: "卷轴" },
    ],
  },
  {
    group: "宠物",
    categories: [
      { id: "collar", label: "项圈" }, { id: "crystal", label: "晶石" },
      { id: "petArmor", label: "装甲" }, { id: "petAccessory", label: "饰品" },
      { id: "petCloth", label: "服装" },
    ],
  },
];

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

export default function WarehouseManager({ recipes }: WarehouseManagerProps) {
  const [items, setItems] = useState<WarehouseItem[]>(() => loadWarehouseItems());
  const [charConfigs, setCharConfigs] = useState<CharacterConfig[]>(() => loadCharacterConfigs());

  // Build material database with simplified names
  const materialDb = useMemo(() => {
    const map = new Map<string, MaterialInfo>();
    for (const r of recipes) {
      for (const m of r.materials) {
        if (!map.has(m.name)) {
          const simplified = traditionalToSimplified[m.name] || m.name;
          map.set(m.name, { name: m.name, image: m.image, simplifiedName: simplified });
        }
      }
    }
    return map;
  }, [recipes]);

  // Lookup: both traditional and simplified name → MaterialInfo
  const materialLookup = useMemo(() => {
    const map = new Map<string, MaterialInfo>();
    for (const [, info] of materialDb) {
      map.set(info.name, info);
      map.set(info.simplifiedName, info);
    }
    return map;
  }, [materialDb]);

  const allMaterialNames = useMemo(() => {
    return Array.from(materialDb.keys()).sort();
  }, [materialDb]);

  const [filterType, setFilterType] = useState<ItemType | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddCharacter, setShowAddCharacter] = useState(false);
  const [newCharacterName, setNewCharacterName] = useState("");
  const [editingCharacter, setEditingCharacter] = useState<string | null>(null);
  const [editRows, setEditRows] = useState<EditRow[]>([]);
  const [editTotalSlots, setEditTotalSlots] = useState(DEFAULT_TOTAL_SLOTS);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferText, setTransferText] = useState("");
  const [transferMode, setTransferMode] = useState<"export" | "import">("export");
  const [confirmAction, setConfirmAction] = useState<{ message: string; action: () => void } | null>(null);
  const [expandedItemKeys, setExpandedItemKeys] = useState<Set<string>>(new Set());
  const [expandedCharacters, setExpandedCharacters] = useState<Set<string>>(new Set());

  // Material picker state
  const [showMaterialPicker, setShowMaterialPicker] = useState(false);
  const [pickerGroup, setPickerGroup] = useState(0);
  const [pickerCategory, setPickerCategory] = useState<Category | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");

  // Recipe lookup state
  const [showRecipeLookup, setShowRecipeLookup] = useState(false);
  const [lookupGroup, setLookupGroup] = useState(0);
  const [lookupCategory, setLookupCategory] = useState<Category | null>(null);
  const [lookupSearch, setLookupSearch] = useState("");
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  useEffect(() => { saveWarehouseItems(items); }, [items]);
  useEffect(() => { saveCharacterConfigs(charConfigs); }, [charConfigs]);

  const getCharTotalSlots = useCallback((charName: string) => {
    return charConfigs.find((c) => c.name === charName)?.totalSlots ?? DEFAULT_TOTAL_SLOTS;
  }, [charConfigs]);

  const getCharUsedSlots = useCallback((charName: string) => {
    return items.filter((i) => i.characterName === charName).reduce((sum, i) => sum + i.slots, 0);
  }, [items]);

  const characterNames = useMemo(() => Array.from(new Set(items.map((i) => i.characterName))).sort(), [items]);

  const itemNames = useMemo(() => {
    const names = new Set(allMaterialNames);
    for (const i of items) names.add(i.itemName);
    return Array.from(names).sort();
  }, [items, allMaterialNames]);

  const groupedByCharacter = useMemo(() => {
    const map = new Map<string, WarehouseItem[]>();
    for (const item of items) {
      if (!map.has(item.characterName)) map.set(item.characterName, []);
      map.get(item.characterName)!.push(item);
    }
    for (const [, arr] of map) arr.sort((a, b) => a.itemType.localeCompare(b.itemType) || a.itemName.localeCompare(b.itemName));
    return map;
  }, [items]);

  // Material names for the selected recipe (for filtering)
  const recipeMaterialNames = useMemo(() => {
    if (!selectedRecipe) return null;
    const names = new Set<string>();
    for (const mat of selectedRecipe.materials) {
      names.add(mat.name);
      const simplified = traditionalToSimplified[mat.name];
      if (simplified) names.add(simplified);
    }
    return names;
  }, [selectedRecipe]);

  const itemMatchesRecipe = useCallback((itemName: string) => {
    if (!recipeMaterialNames) return true;
    if (recipeMaterialNames.has(itemName)) return true;
    const lookup = materialLookup.get(itemName);
    return !!lookup && recipeMaterialNames.has(lookup.name);
  }, [recipeMaterialNames, materialLookup]);

  const statsData = useMemo(() => {
    const map = new Map<string, { type: ItemType; unit: ItemUnit; characters: { name: string; quantity: number; itemId: string }[]; total: number }>();
    for (const item of items) {
      const key = `${item.itemName}|${item.unit}`;
      if (!map.has(key)) map.set(key, { type: item.itemType, unit: item.unit, characters: [], total: 0 });
      const entry = map.get(key)!;
      entry.characters.push({ name: item.characterName, quantity: item.quantity, itemId: item.id });
      entry.total += item.quantity;
    }
    let result = Array.from(map.entries()).map(([key, val]) => ({
      key, itemName: key.split("|")[0], ...val,
      characters: val.characters.sort((a, b) => b.quantity - a.quantity),
    }));
    if (filterType) result = result.filter((i) => i.type === filterType);
    if (recipeMaterialNames) result = result.filter((i) => itemMatchesRecipe(i.itemName));
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((i) => {
        const simplified = traditionalToSimplified[i.itemName]?.toLowerCase() || "";
        const traditional = simplifiedToTraditional[i.itemName]?.toLowerCase() || "";
        return i.itemName.toLowerCase().includes(q) || simplified.includes(q) || traditional.includes(q);
      });
    }
    return result.sort((a, b) => a.itemName.localeCompare(b.itemName));
  }, [items, filterType, searchQuery, recipeMaterialNames, itemMatchesRecipe]);

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
    setNewCharacterName(""); setShowAddCharacter(false);
    if (characterNames.includes(name)) { startEditing(name, groupedByCharacter.get(name) || []); return; }
    startEditing(name, []);
  }, [newCharacterName, characterNames, groupedByCharacter]);

  const handleDeleteCharacter = useCallback((charName: string) => {
    setConfirmAction({
      message: `确认删除角色「${charName}」及其所有物资记录？`,
      action: () => {
        setItems((prev) => prev.filter((i) => i.characterName !== charName));
        setCharConfigs((prev) => prev.filter((c) => c.name !== charName));
        if (editingCharacter === charName) { setEditingCharacter(null); setEditRows([]); }
        setExpandedCharacters((prev) => { const next = new Set(prev); next.delete(charName); return next; });
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
      id: i.id, itemType: i.itemType, itemName: i.itemName, quantity: i.quantity, unit: i.unit, slots: i.slots, materialImage: i.materialImage,
    }));
    const defaults = lastRowDefaults(rows);
    rows.push({ id: generateId(), itemType: defaults.type, itemName: "", quantity: 1, unit: defaults.unit, slots: 1 });
    setEditRows(rows);
  }, [getCharTotalSlots]);

  const handleRowChange = useCallback((idx: number, field: keyof EditRow, value: any) => {
    setEditRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      if (field === "quantity") {
        next[idx] = { ...next[idx], slots: Math.ceil(Number(value) || 0) };
      }
      if (field === "itemName") {
        const mat = materialLookup.get(String(value));
        next[idx] = { ...next[idx], materialImage: mat?.image };
      }
      if (idx === next.length - 1 && next[idx].itemName.trim()) {
        const d = lastRowDefaults(next);
        next.push({ id: generateId(), itemType: d.type, itemName: "", quantity: 1, unit: d.unit, slots: 1 });
      }
      return next;
    });
  }, [materialLookup]);

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

  // Add material from picker
  const handlePickMaterial = useCallback((matName: string, matImage: string) => {
    setEditRows((prev) => {
      const next = [...prev];
      const lastIdx = next.length - 1;
      // Fill the last empty row
      if (lastIdx >= 0 && !next[lastIdx].itemName.trim()) {
        next[lastIdx] = { ...next[lastIdx], itemName: matName, materialImage: matImage };
      } else {
        const d = lastRowDefaults(next);
        next.push({ id: generateId(), itemType: d.type, itemName: matName, quantity: 1, unit: d.unit, slots: 1, materialImage: matImage });
      }
      // Add new empty row
      const d2 = lastRowDefaults(next);
      next.push({ id: generateId(), itemType: d2.type, itemName: "", quantity: 1, unit: d2.unit, slots: 1 });
      return next;
    });
  }, []);

  const handleSaveEditing = useCallback(() => {
    if (!editingCharacter) return;
    const charName = editingCharacter;
    const validRows = editRows.filter((r) => r.itemName.trim() && r.quantity > 0);
    setItems((prev) => {
      const others = prev.filter((i) => i.characterName !== charName);
      const newItems: WarehouseItem[] = validRows.map((r) => ({
        id: r.id, characterName: charName, itemType: r.itemType, itemName: r.itemName.trim(),
        quantity: r.quantity, unit: r.unit, slots: r.slots,
        materialImage: r.materialImage || materialLookup.get(r.itemName.trim())?.image,
      }));
      return [...others, ...newItems];
    });
    setCharConfigs((prev) => {
      const others = prev.filter((c) => c.name !== charName);
      return [...others, { name: charName, totalSlots: editTotalSlots }];
    });
    setEditingCharacter(null); setEditRows([]);
  }, [editingCharacter, editRows, editTotalSlots, materialLookup]);

  const handleCancelEditing = useCallback(() => { setEditingCharacter(null); setEditRows([]); }, []);

  const handleInlineQuantityChange = useCallback((itemId: string, newQty: number) => {
    setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, quantity: Math.max(0, newQty) } : i));
  }, []);

  // --- Import/Export ---
  const handleOpenExport = useCallback(() => {
    const json = JSON.stringify({ items, charConfigs });
    setTransferText(btoa(unescape(encodeURIComponent(json))));
    setTransferMode("export"); setShowTransfer(true);
  }, [items, charConfigs]);
  const handleOpenImport = useCallback(() => { setTransferText(""); setTransferMode("import"); setShowTransfer(true); }, []);
  const handleImportConfirm = useCallback(() => {
    try {
      const json = decodeURIComponent(escape(atob(transferText.trim())));
      const parsed = JSON.parse(json);
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
      setShowTransfer(false); setTransferText("");
    } catch { alert("数据解析失败，请确认粘贴的内容正确"); }
  }, [transferText]);
  const handleCopyExport = useCallback(() => { navigator.clipboard.writeText(transferText).then(() => alert("已复制到剪贴板")); }, [transferText]);

  // --- Material picker filtered list ---
  const pickerMaterials = useMemo(() => {
    if (!pickerCategory) return [];
    const catRecipes = recipes.filter((r) => r.category === pickerCategory);
    const matSet = new Map<string, string>();
    for (const r of catRecipes) {
      for (const m of r.materials) {
        if (!matSet.has(m.name)) matSet.set(m.name, m.image);
      }
    }
    let result = Array.from(matSet.entries()).map(([name, image]) => ({ name, image, simplified: traditionalToSimplified[name] || name }));
    if (pickerSearch.trim()) {
      const q = pickerSearch.trim().toLowerCase();
      result = result.filter((m) => m.name.toLowerCase().includes(q) || m.simplified.toLowerCase().includes(q));
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [recipes, pickerCategory, pickerSearch]);

  // --- Recipe lookup ---
  const lookupRecipes = useMemo(() => {
    if (!lookupCategory) return [];
    let result = recipes.filter((r) => r.category === lookupCategory);
    if (lookupSearch.trim()) {
      const q = lookupSearch.trim().toLowerCase();
      result = result.filter((r) => {
        const simplified = traditionalToSimplified[r.name]?.toLowerCase() || "";
        return r.name.toLowerCase().includes(q) || simplified.includes(q);
      });
    }
    return result.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  }, [recipes, lookupCategory, lookupSearch]);

  // For a selected recipe, find warehouse stock for each material
  const recipeStock = useMemo(() => {
    if (!selectedRecipe) return [];
    return selectedRecipe.materials.map((mat) => {
      const matching = items.filter((i) => {
        if (i.itemName === mat.name) return true;
        const lookup = materialLookup.get(i.itemName);
        return lookup && lookup.name === mat.name;
      });
      const total = matching.reduce((s, i) => s + i.quantity, 0);
      return {
        ...mat,
        simplified: traditionalToSimplified[mat.name] || mat.name,
        stock: matching.map((i) => ({ character: i.characterName, quantity: i.quantity, unit: i.unit })),
        totalStock: total,
      };
    });
  }, [selectedRecipe, items, materialLookup]);

  const inputCls = "w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500";
  const selectCls = "bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500";
  const pillActive = "bg-accent-500 text-white shadow-sm shadow-accent-500/20";
  const pillInactive = "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900";

  const filteredCharacters = useMemo(() => {
    return characterNames.filter((name) => {
      const charItems = groupedByCharacter.get(name) || [];
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        if (!name.toLowerCase().includes(q) && !charItems.some((i) => {
          const s = traditionalToSimplified[i.itemName]?.toLowerCase() || "";
          const t = simplifiedToTraditional[i.itemName]?.toLowerCase() || "";
          return i.itemName.toLowerCase().includes(q) || s.includes(q) || t.includes(q);
        })) return false;
      }
      if (filterType && !charItems.some((i) => i.itemType === filterType)) return false;
      if (recipeMaterialNames && !charItems.some((i) => itemMatchesRecipe(i.itemName))) return false;
      return true;
    });
  }, [characterNames, groupedByCharacter, searchQuery, filterType, recipeMaterialNames, itemMatchesRecipe]);

  return (
    <div>
      {/* Data warning */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 text-xs text-amber-700">
        数据完全存储在本地浏览器中，清理浏览器记录会导致数据丢失。建议定期导出备份。
      </div>

      {/* Import/Export + Recipe lookup */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button type="button" onClick={handleOpenExport} disabled={items.length === 0}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          导出数据
        </button>
        <button type="button" onClick={handleOpenImport}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
          导入数据
        </button>
        <button type="button" onClick={() => { setShowRecipeLookup(!showRecipeLookup); if (showRecipeLookup) { setSelectedRecipe(null); } else { setLookupCategory(RECIPE_GROUPS[lookupGroup].categories[0].id); setLookupSearch(""); } }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showRecipeLookup ? pillActive : "bg-blue-50 text-blue-600 hover:bg-blue-100"}`}>
          按配方查库存
        </button>
        {selectedRecipe && (
          <button type="button" onClick={() => { setSelectedRecipe(null); }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
            清除配方筛选: {traditionalToSimplified[selectedRecipe.name] || selectedRecipe.name} &times;
          </button>
        )}
      </div>

      {confirmAction && <ConfirmDialog message={confirmAction.message} onConfirm={confirmAction.action} onCancel={() => setConfirmAction(null)} />}

      {/* Transfer modal */}
      {showTransfer && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowTransfer(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-800 mb-3">{transferMode === "export" ? "导出数据" : "导入数据"}</h3>
            {transferMode === "export" ? (
              <>
                <p className="text-xs text-gray-500 mb-2">复制下方文本，通过聊天工具发送给其他人即可分享数据。</p>
                <textarea readOnly value={transferText} className="w-full h-32 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-600 resize-none focus:outline-none" onFocus={(e) => e.target.select()} />
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
                    className="px-4 py-1.5 rounded-lg text-xs font-medium bg-accent-500 text-white hover:bg-accent-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">导入</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Recipe lookup inline panel */}
      {showRecipeLookup && !selectedRecipe && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-4 p-3">
          {/* Group tabs */}
          <div className="flex gap-1 mb-2 flex-wrap">
            {RECIPE_GROUPS.map((g, idx) => (
              <button key={g.group} type="button" onClick={() => { setLookupGroup(idx); setLookupCategory(g.categories[0].id); }}
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all ${lookupGroup === idx ? pillActive : pillInactive}`}>
                {g.group}
              </button>
            ))}
          </div>
          {/* Category pills */}
          <div className="flex gap-1 mb-2 flex-wrap">
            {RECIPE_GROUPS[lookupGroup].categories.map((cat) => (
              <button key={cat.id} type="button" onClick={() => { setLookupCategory(cat.id); }}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${lookupCategory === cat.id ? pillActive : pillInactive}`}>
                {cat.label}
              </button>
            ))}
          </div>
          <input type="text" value={lookupSearch} onChange={(e) => setLookupSearch(e.target.value)} placeholder="搜索配方名..."
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent-500/20 mb-2" />
          {lookupRecipes.length === 0 ? (
            <div className="text-center text-gray-400 text-xs py-4">{lookupCategory ? "没有匹配的配方" : "请先选择分类"}</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5 max-h-48 overflow-y-auto">
              {lookupRecipes.map((r) => (
                <button key={r.id} type="button" onClick={() => { setSelectedRecipe(r); setShowRecipeLookup(false); }}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 text-left transition-colors">
                  <img src={`/items/${r.image}`} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium text-gray-800 truncate">{traditionalToSimplified[r.name] || r.name}</div>
                    <div className="text-[10px] text-gray-400">Lv.{r.level}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recipe stock summary when recipe is selected */}
      {selectedRecipe && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg mb-4 p-3">
          <div className="flex items-center gap-2 mb-2">
            <img src={`/items/${selectedRecipe.image}`} alt="" className="w-6 h-6 object-contain" />
            <span className="text-xs font-semibold text-gray-800">{traditionalToSimplified[selectedRecipe.name] || selectedRecipe.name}</span>
            <span className="text-[10px] text-gray-400">Lv.{selectedRecipe.level}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {recipeStock.map((mat) => (
              <div key={mat.name} className="flex items-center gap-1.5 bg-white rounded px-2 py-1 border border-blue-100">
                <img src={`/items/${mat.image}`} alt="" className="w-4 h-4 object-contain" />
                <span className="text-[11px] text-gray-700">{mat.simplified !== mat.name ? mat.simplified : mat.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Material picker modal */}
      {showMaterialPicker && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowMaterialPicker(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-3 border-b border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-800">选择材料</h3>
                <button type="button" onClick={() => setShowMaterialPicker(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
              </div>
              <div className="flex gap-1 mb-2 flex-wrap">
                {RECIPE_GROUPS.map((g, idx) => (
                  <button key={g.group} type="button" onClick={() => { setPickerGroup(idx); setPickerCategory(g.categories[0].id); }}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all ${pickerGroup === idx ? pillActive : pillInactive}`}>
                    {g.group}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 mb-2 flex-wrap">
                {RECIPE_GROUPS[pickerGroup].categories.map((cat) => (
                  <button key={cat.id} type="button" onClick={() => setPickerCategory(cat.id)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${pickerCategory === cat.id ? pillActive : pillInactive}`}>
                    {cat.label}
                  </button>
                ))}
              </div>
              <input type="text" value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)} placeholder="搜索材料..."
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent-500/20" />
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {pickerMaterials.length === 0 ? (
                <div className="text-center text-gray-400 text-xs py-6">{pickerCategory ? "没有匹配的材料" : "请先选择分类"}</div>
              ) : (
                <div className="grid grid-cols-2 gap-1">
                  {pickerMaterials.map((m) => (
                    <button key={m.name} type="button"
                      onClick={() => { handlePickMaterial(m.name, m.image); setShowMaterialPicker(false); }}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-gray-100 hover:bg-accent-50 hover:border-accent-200 text-left transition-colors">
                      <img src={`/items/${m.image}`} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[11px] text-gray-700 truncate">{m.simplified !== m.name ? m.simplified : m.name}</div>
                        {m.simplified !== m.name && <div className="text-[9px] text-gray-400 truncate">{m.name}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filters + add character */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input type="text" placeholder="搜索物资或角色..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          className="w-48 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500" />
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          <button type="button" onClick={() => setFilterType(null)} className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all duration-150 ${filterType === null ? pillActive : pillInactive}`}>全部</button>
          {ITEM_TYPES.map((t) => (
            <button key={t} type="button" onClick={() => setFilterType(t === filterType ? null : t)}
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all duration-150 ${filterType === t ? pillActive : pillInactive}`}>{t}</button>
          ))}
        </div>
        {showAddCharacter ? (
          <div className="ml-auto flex items-center gap-2">
            <input type="text" value={newCharacterName} onChange={(e) => setNewCharacterName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddCharacter(); if (e.key === "Escape") { setShowAddCharacter(false); setNewCharacterName(""); } }}
              placeholder="输入角色名..." autoFocus
              className="w-32 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500" />
            <button type="button" onClick={handleAddCharacter} disabled={!newCharacterName.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent-500 text-white shadow-sm hover:bg-accent-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">确定</button>
            <button type="button" onClick={() => { setShowAddCharacter(false); setNewCharacterName(""); }}
              className="px-2 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">取消</button>
          </div>
        ) : (
          <button type="button" onClick={() => setShowAddCharacter(true)}
            className="ml-auto px-3.5 py-1.5 rounded-lg text-xs font-medium bg-accent-500 text-white shadow-sm hover:bg-accent-600 transition-colors">+ 添加角色</button>
        )}
      </div>

      {/* Batch editing panel */}
      {editingCharacter !== null && (() => {
        const usedSlots = editRows.filter((r) => r.itemName.trim() && r.quantity > 0).reduce((s, r) => s + r.slots, 0);
        return (
        <div className="bg-white border border-accent-200 rounded-xl p-4 mb-4 shadow-sm">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-gray-800">
                编辑 <span className="text-accent-600">{editingCharacter}</span> 的物资
              </h3>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <span className={`font-mono font-semibold ${usedSlots > editTotalSlots ? "text-red-500" : "text-gray-700"}`}>{usedSlots}</span>
                <span>/</span>
                <input type="number" value={editTotalSlots} onChange={(e) => setEditTotalSlots(Number(e.target.value) || DEFAULT_TOTAL_SLOTS)}
                  min={1} className="w-12 text-center font-mono font-semibold bg-white border border-gray-200 rounded px-1 py-0 text-xs focus:outline-none focus:ring-1 focus:ring-accent-500/30" />
                <span>格</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setPickerSearch(""); setPickerCategory(RECIPE_GROUPS[0].categories[0].id); setPickerGroup(0); setShowMaterialPicker(true); }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">从资料库选择</button>
              <button type="button" onClick={handleCancelEditing} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">取消</button>
              <button type="button" onClick={handleSaveEditing} className="px-4 py-1.5 rounded-lg text-xs font-medium bg-accent-500 text-white hover:bg-accent-600 transition-colors">保存全部</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-gray-500 text-xs border-b border-gray-200">
                  <th className="py-2 px-1 font-medium w-7"></th>
                  <th className="py-2 px-2 font-medium w-24">类型</th>
                  <th className="py-2 px-2 font-medium w-32">名称</th>
                  <th className="py-2 px-2 font-medium w-20 text-right">数量</th>
                  <th className="py-2 px-2 font-medium w-16">单位</th>
                  <th className="py-2 px-2 font-medium w-20 text-right">占格</th>
                  <th className="py-2 px-2 font-medium w-12 text-center">操作</th>
                </tr>
              </thead>
              <tbody>
                {editRows.map((row, idx) => (
                  <tr key={row.id} className="border-b border-gray-50">
                    <td className="py-1.5 px-1 w-7">
                      {(row.materialImage || materialLookup.get(row.itemName)?.image) && (
                        <img src={`/items/${row.materialImage || materialLookup.get(row.itemName)?.image}`} alt="" className="w-5 h-5 object-contain" />
                      )}
                    </td>
                    <td className="py-1.5 px-2">
                      <select value={row.itemType} onChange={(e) => handleRowChange(idx, "itemType", e.target.value)}
                        className={selectCls + " w-full text-xs py-1"}>
                        {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 px-2">
                      <input type="text" value={row.itemName} onChange={(e) => handleRowChange(idx, "itemName", e.target.value)}
                        list="wh-item-list" placeholder={idx === editRows.length - 1 ? "输入名称或从资料库选择..." : "物资名称"}
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
                        <button type="button" onClick={() => handleDeleteRow(idx)} className="text-xs text-red-400 hover:text-red-600">删除</button>
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

      {/* Character tags */}
      <h2 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">角色仓库</h2>
      {filteredCharacters.length === 0 && editingCharacter === null ? (
        <div className="text-center text-slate-400 py-3 text-xs">{items.length === 0 ? '点击"+ 添加角色"开始' : "没有匹配的记录"}</div>
      ) : (
        <div className="flex flex-wrap gap-1 mb-2">
          {filteredCharacters.map((charName) => {
            if (editingCharacter === charName) return null;
            const used = getCharUsedSlots(charName);
            const total = getCharTotalSlots(charName);
            const isExpanded = expandedCharacters.has(charName);
            return (
              <button key={charName} type="button" onClick={() => setExpandedCharacters((prev) => { const next = new Set(prev); if (next.has(charName)) next.delete(charName); else next.add(charName); return next; })}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  isExpanded ? "bg-accent-500 text-white" : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}>
                <span>{charName}</span>
                <span className={`text-[10px] font-mono ${isExpanded ? "text-white/70" : used >= total ? "text-red-400" : "text-gray-400"}`}>{used}/{total}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Expanded character details */}
      {expandedCharacters.size > 0 && editingCharacter === null && Array.from(expandedCharacters).filter((cn) => filteredCharacters.includes(cn)).map((charName) => {
        let charItems = groupedByCharacter.get(charName) || [];
        if (filterType) charItems = charItems.filter((i) => i.itemType === filterType);
        if (recipeMaterialNames) charItems = charItems.filter((i) => itemMatchesRecipe(i.itemName));
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          charItems = charItems.filter((i) => {
            const s = traditionalToSimplified[i.itemName]?.toLowerCase() || "";
            return i.itemName.toLowerCase().includes(q) || s.includes(q);
          });
        }
        const used = getCharUsedSlots(charName);
        const total = getCharTotalSlots(charName);
        return (
          <div key={charName} className="bg-white border border-gray-200 rounded-md shadow-sm mb-4 overflow-hidden">
            <div className="flex items-center justify-between px-2.5 py-1.5 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-800 text-xs">{charName}</span>
                <span className={`text-[10px] font-mono ${used >= total ? "text-red-400" : "text-gray-400"}`}>{used}/{total}格</span>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => { startEditing(charName, groupedByCharacter.get(charName) || []); setExpandedCharacters((prev) => { const next = new Set(prev); next.delete(charName); return next; }); }}
                  className="text-[10px] text-accent-500 hover:text-accent-700 font-medium">编辑</button>
                <button type="button" onClick={() => handleDeleteCharacter(charName)}
                  className="text-[10px] text-red-400 hover:text-red-600 font-medium">删除角色</button>
              </div>
            </div>
            {charItems.length === 0 ? (
              <div className="px-2.5 py-2 text-[10px] text-gray-400">暂无物资，点击编辑添加</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 px-2.5 py-1">
                {charItems.map((item) => {
                  const img = item.materialImage || materialLookup.get(item.itemName)?.image;
                  return (
                    <div key={item.id} className="flex items-center py-[1px] text-[11px] leading-tight gap-1">
                      {img && <img src={`/items/${img}`} alt="" className="w-4 h-4 object-contain flex-shrink-0" />}
                      <span className="text-gray-700 min-w-0 truncate">{item.itemName}</span>
                      <span className="tabular-nums text-gray-500 ml-auto pl-1 flex-shrink-0">{item.quantity}{item.unit}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Stats by category */}
      <h2 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">物资统计</h2>
      {statsGroupedByType.length === 0 ? (
        <div className="text-center text-slate-400 py-3 text-xs">{items.length === 0 ? "添加物资后显示统计" : "没有匹配的物资"}</div>
      ) : (
        <div className="space-y-3">
          {statsGroupedByType.map(({ type, items: typeItems }) => (
            <div key={type}>
              <h3 className="text-[11px] font-semibold text-gray-500 mb-1">{type}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5">
                {typeItems.map((stat) => {
                  const isExpanded = expandedItemKeys.has(stat.key);
                  return (
                    <div key={stat.key} className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
                      <div className="flex items-center justify-between px-2 py-1 cursor-pointer hover:bg-gray-50 transition-colors gap-1"
                        onClick={() => setExpandedItemKeys((prev) => { const next = new Set(prev); if (next.has(stat.key)) next.delete(stat.key); else next.add(stat.key); return next; })}>
                        {materialLookup.get(stat.itemName)?.image && (
                          <img src={`/items/${materialLookup.get(stat.itemName)!.image}`} alt="" className="w-4 h-4 object-contain flex-shrink-0" />
                        )}
                        <span className="text-gray-800 text-[11px] font-medium min-w-0 truncate">{stat.itemName}</span>
                        <span className="tabular-nums font-semibold text-gray-600 text-[11px] ml-auto flex-shrink-0">{stat.total}{stat.unit}</span>
                      </div>
                      {isExpanded && (
                        <div className="border-t border-gray-100 px-2 py-1 space-y-0.5 bg-gray-50/50">
                          {stat.characters.map((ch) => (
                            <div key={ch.itemId} className="flex items-center gap-1">
                              <span className="text-[10px] text-gray-500 min-w-0 truncate flex-1">{ch.name}</span>
                              <button type="button" onClick={() => handleInlineQuantityChange(ch.itemId, ch.quantity - 1)}
                                className="w-4 h-4 rounded bg-gray-200/80 text-gray-500 hover:bg-gray-300 text-[9px] font-bold flex items-center justify-center flex-shrink-0">-</button>
                              <input type="number" value={ch.quantity} onChange={(e) => handleInlineQuantityChange(ch.itemId, Number(e.target.value) || 0)}
                                className="w-10 text-center text-[10px] font-mono bg-white border border-gray-200 rounded px-0.5 py-0 focus:outline-none focus:ring-1 focus:ring-accent-500/30" />
                              <button type="button" onClick={() => handleInlineQuantityChange(ch.itemId, ch.quantity + 1)}
                                className="w-4 h-4 rounded bg-gray-200/80 text-gray-500 hover:bg-gray-300 text-[9px] font-bold flex items-center justify-center flex-shrink-0">+</button>
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
