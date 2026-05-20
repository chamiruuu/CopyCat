import { useState, useEffect } from "react";
import {
  writeTextFile,
  readTextFile,
  BaseDirectory,
  exists,
} from "@tauri-apps/plugin-fs";
import { register } from "@tauri-apps/plugin-global-shortcut";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Menu } from "@tauri-apps/api/menu";
import { TrayIcon } from "@tauri-apps/api/tray";
import { defaultWindowIcon } from "@tauri-apps/api/app";
import {
  Settings,
  Plus,
  Search,
  Edit2,
  Trash2,
  Check,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import logo from "./assets/CopyCat.png";

const FILE_SNIPPETS = "copycat_data.json";
const FILE_CATEGORIES = "copycat_cats.json";

const defaultCategories = [
  { id: "1", name: "General", color: "#2dd4bf" },
  { id: "2", name: "Code", color: "#3b82f6" },
  { id: "3", name: "Emails", color: "#f59e0b" },
];

const defaultSnippets = [
  {
    id: 1,
    title: "Quick Reply",
    categoryId: "3",
    text: "Thanks for reaching out. I will get back to you shortly.",
  },
  {
    id: 2,
    title: "FastAPI Boilerplate",
    categoryId: "2",
    text: 'from fastapi import FastAPI\n\napp = FastAPI()\n\n@app.get("/")\ndef read_root():\n    return {"Hello": "World"}',
  },
];

const getDynamicStyle = (hexColor) => {
  const hex = hexColor || "#888888";
  return {
    color: hex,
    backgroundColor: `${hex}1A`,
    borderColor: `${hex}33`,
  };
};

export default function App() {
  const [activeCategoryId, setActiveCategoryId] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const [snippets, setSnippets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [copiedId, setCopiedId] = useState(null);

  const [deleteAlert, setDeleteAlert] = useState({
    open: false,
    type: "",
    id: null,
    message: "",
    subMessage: "",
  });

  const [isSnippetModalOpen, setIsSnippetModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newTitle, setNewTitle] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newText, setNewText] = useState("");
  const [inlineCatName, setInlineCatName] = useState("");
  const [inlineCatColor, setInlineCatColor] = useState("#2dd4bf");

  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCatId, setEditingCatId] = useState(null);
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#2dd4bf");

  useEffect(() => {
    const handleContextMenu = (e) => e.preventDefault();
    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  useEffect(() => {
    let unlistenClose;

    async function initApp() {
      try {
        if (
          await exists(FILE_CATEGORIES, { baseDir: BaseDirectory.AppLocalData })
        ) {
          setCategories(
            JSON.parse(
              await readTextFile(FILE_CATEGORIES, {
                baseDir: BaseDirectory.AppLocalData,
              }),
            ),
          );
        } else setCategories(defaultCategories);
      } catch (e) {
        console.error("Error loading categories:", e);
      }

      try {
        if (
          await exists(FILE_SNIPPETS, { baseDir: BaseDirectory.AppLocalData })
        ) {
          setSnippets(
            JSON.parse(
              await readTextFile(FILE_SNIPPETS, {
                baseDir: BaseDirectory.AppLocalData,
              }),
            ),
          );
        } else setSnippets(defaultSnippets);
      } catch (e) {
        console.error("Error loading snippets:", e);
      }

      const appWindow = getCurrentWindow();
      unlistenClose = await appWindow.onCloseRequested((e) => {
        e.preventDefault();
        appWindow.hide();
      });

      try {
        await register("CommandOrControl+Shift+V", async (e) => {
          if (e.state === "Pressed") {
            await appWindow.show();
            await appWindow.setFocus();
          }
        });
      } catch (e) {
        console.error(e);
      }

      try {
        const menu = await Menu.new({
          items: [
            {
              id: "show",
              text: "Show CopyCat",
              action: () => appWindow.show(),
            },
            { id: "hide", text: "Hide", action: () => appWindow.hide() },
            { id: "separator", text: "-" },
            { id: "quit", text: "Quit", action: () => process.exit(0) },
          ],
        });
        await TrayIcon.new({
          icon: await defaultWindowIcon(),
          menu,
          menuOnLeftClick: true,
        });
      } catch (e) {
        console.error(e);
      }
    }

    initApp();
    return () => {
      if (unlistenClose) unlistenClose.then((fn) => fn());
    };
  }, []);

  const saveSnippets = async (data) => {
    setSnippets(data);
    try {
      await writeTextFile(FILE_SNIPPETS, JSON.stringify(data, null, 2), {
        baseDir: BaseDirectory.AppLocalData,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const saveCategories = async (data) => {
    setCategories(data);
    try {
      await writeTextFile(FILE_CATEGORIES, JSON.stringify(data, null, 2), {
        baseDir: BaseDirectory.AppLocalData,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopy = async (snippet, e) => {
    if (e.target.closest("button")) return;
    try {
      await navigator.clipboard.writeText(snippet.text);
      setCopiedId(snippet.id);
      setTimeout(async () => {
        setCopiedId(null);
        await getCurrentWindow().hide();
      }, 300);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveSnippet = (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newText.trim()) return;

    let finalCategoryId = newCategoryId;

    if (newCategoryId === "CREATE_NEW") {
      if (!inlineCatName.trim()) return;
      const newCat = {
        id: Date.now().toString(),
        name: inlineCatName.trim(),
        color: inlineCatColor,
      };
      saveCategories([...categories, newCat]);
      finalCategoryId = newCat.id;
    }

    let updated;
    if (editingId) {
      updated = snippets.map((s) =>
        s.id === editingId
          ? {
              ...s,
              title: newTitle.trim(),
              categoryId: finalCategoryId,
              text: newText.trim(),
            }
          : s,
      );
    } else {
      updated = [
        ...snippets,
        {
          id: Date.now(),
          title: newTitle.trim(),
          categoryId: finalCategoryId,
          text: newText.trim(),
        },
      ];
    }

    saveSnippets(updated);
    setIsSnippetModalOpen(false);
  };

  const handleSaveCategory = (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    if (editingCatId) {
      const updatedCats = categories.map((c) =>
        c.id === editingCatId
          ? { ...c, name: newCatName.trim(), color: newCatColor }
          : c,
      );
      saveCategories(updatedCats);
      setEditingCatId(null);
    } else {
      saveCategories([
        ...categories,
        {
          id: Date.now().toString(),
          name: newCatName.trim(),
          color: newCatColor,
        },
      ]);
    }
    setNewCatName("");
  };

  const confirmDelete = () => {
    if (deleteAlert.type === "snippet") {
      saveSnippets(snippets.filter((s) => s.id !== deleteAlert.id));
    } else if (deleteAlert.type === "category") {
      const generalCat = categories.find(
        (c) => c.name.toLowerCase() === "general",
      ) ||
        categories[0] || { id: "fallback" };
      saveSnippets(
        snippets.map((s) =>
          s.categoryId === deleteAlert.id
            ? { ...s, categoryId: generalCat.id }
            : s,
        ),
      );
      saveCategories(categories.filter((c) => c.id !== deleteAlert.id));
      if (activeCategoryId === deleteAlert.id) setActiveCategoryId("All");
    }
    setDeleteAlert({ ...deleteAlert, open: false });
  };

  const moveCategory = (index, direction) => {
    if (
      (direction === -1 && index === 0) ||
      (direction === 1 && index === categories.length - 1)
    )
      return;
    const newCategories = [...categories];
    const temp = newCategories[index];
    newCategories[index] = newCategories[index + direction];
    newCategories[index + direction] = temp;
    saveCategories(newCategories);
  };

  // NEW: Snippet Sorting Logic
  const moveSnippet = (snippetId, direction) => {
    // Get the exact order of the currently visible snippets
    const currentFiltered = snippets.filter((snippet) => {
      const matchesCat =
        activeCategoryId === "All" || snippet.categoryId === activeCategoryId;
      const matchesSearch =
        snippet.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        snippet.text.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });

    const filteredIdx = currentFiltered.findIndex((s) => s.id === snippetId);
    if (filteredIdx === -1) return;

    const targetFilteredIdx = filteredIdx + direction;
    if (targetFilteredIdx < 0 || targetFilteredIdx >= currentFiltered.length)
      return;

    const targetSnippetId = currentFiltered[targetFilteredIdx].id;

    // Find those exact snippets in the master list and swap their positions
    const mainIdx1 = snippets.findIndex((s) => s.id === snippetId);
    const mainIdx2 = snippets.findIndex((s) => s.id === targetSnippetId);

    const newSnippets = [...snippets];
    const temp = newSnippets[mainIdx1];
    newSnippets[mainIdx1] = newSnippets[mainIdx2];
    newSnippets[mainIdx2] = temp;

    saveSnippets(newSnippets);
  };

  const openSnippetModal = (snippet = null) => {
    if (snippet) {
      setEditingId(snippet.id);
      setNewTitle(snippet.title);
      setNewCategoryId(snippet.categoryId);
      setNewText(snippet.text);
    } else {
      setEditingId(null);
      setNewTitle("");
      setNewCategoryId(categories.length > 0 ? categories[0].id : "CREATE_NEW");
      setNewText("");
      setInlineCatName("");
    }
    setIsSnippetModalOpen(true);
  };

  const filteredSnippets = snippets.filter((snippet) => {
    const matchesCat =
      activeCategoryId === "All" || snippet.categoryId === activeCategoryId;
    const matchesSearch =
      snippet.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      snippet.text.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background text-white flex flex-col font-sans selection:bg-teal-500/30 selection:text-white">
      <header className="h-16 border-b border-borderLine flex items-center justify-between px-6 shrink-0 bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2 text-teal-400">
          <img
            src={logo}
            alt="CopyCat Logo"
            className="w-7 h-7 object-contain drop-shadow-md"
          />
          <span className="text-white">CopyCat</span>
        </h1>

        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            type="text"
            placeholder="Search snippets..."
            className="bg-card border border-borderLine rounded-md pl-9 pr-4 py-1.5 w-72 text-sm focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/50 transition-all placeholder:text-gray-600"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <button
          onClick={() => openSnippetModal()}
          className="bg-white text-black font-semibold px-4 py-1.5 rounded-md text-sm hover:bg-gray-200 transition-colors shadow-[0_0_15px_rgba(255,255,255,0.1)] flex items-center gap-1"
        >
          <Plus size={16} strokeWidth={3} /> New Snippet
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-48 border-r border-borderLine flex flex-col shrink-0 bg-background">
          <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-1">
            <button
              onClick={() => setActiveCategoryId("All")}
              className={`text-left px-3 py-2 rounded-md text-sm font-medium transition-all ${activeCategoryId === "All" ? "bg-teal-500/10 text-teal-400 border border-teal-500/20" : "text-textMuted hover:bg-card hover:text-white border border-transparent"}`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryId(cat.id)}
                className={`text-left px-3 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeCategoryId === cat.id ? "bg-card text-white border border-borderLine" : "text-textMuted hover:bg-card hover:text-white border border-transparent"}`}
              >
                <span
                  className="w-2 h-2 rounded-full shadow-sm"
                  style={{ backgroundColor: cat.color }}
                ></span>
                {cat.name}
              </button>
            ))}
          </div>

          <div className="p-4 border-t border-borderLine">
            <button
              onClick={() => {
                setIsCatModalOpen(true);
                setEditingCatId(null);
                setNewCatName("");
              }}
              className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-textMuted hover:bg-card hover:text-white transition-all flex items-center gap-2"
            >
              <Settings size={16} /> Manage
            </button>
          </div>
        </aside>

        <main className="flex-1 p-6 overflow-y-auto">
          <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
            {filteredSnippets.map((snippet, index) => {
              const isCopied = copiedId === snippet.id;
              const category = categories.find(
                (c) => c.id === snippet.categoryId,
              );

              return (
                <div
                  key={snippet.id}
                  onClick={(e) => handleCopy(snippet, e)}
                  className={`break-inside-avoid border rounded-lg p-4 cursor-pointer transition-all duration-200 group relative
                    ${isCopied ? "bg-[#121c15] border-teal-500/50 shadow-[0_0_15px_rgba(45,212,191,0.1)]" : "bg-card border-borderLine hover:border-gray-500 hover:shadow-lg"}
                  `}
                >
                  <div className="flex justify-between items-center mb-3">
                    {category && (
                      <span
                        className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border"
                        style={getDynamicStyle(category.color)}
                      >
                        {category.name}
                      </span>
                    )}

                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Movement Arrows */}
                      <div className="flex border-r border-borderLine pr-1 mr-1">
                        <button
                          onClick={() => moveSnippet(snippet.id, -1)}
                          disabled={index === 0}
                          className="text-gray-500 hover:text-white disabled:opacity-0 p-1 rounded-md transition-colors"
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <button
                          onClick={() => moveSnippet(snippet.id, 1)}
                          disabled={index === filteredSnippets.length - 1}
                          className="text-gray-500 hover:text-white disabled:opacity-0 p-1 rounded-md transition-colors"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>

                      {/* Edit & Delete */}
                      <button
                        onClick={() => openSnippetModal(snippet)}
                        className="text-textMuted hover:text-teal-400 p-1 rounded-md hover:bg-teal-400/10 transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() =>
                          setDeleteAlert({
                            open: true,
                            type: "snippet",
                            id: snippet.id,
                            message: "Delete this snippet?",
                            subMessage: "This action cannot be undone.",
                          })
                        }
                        className="text-textMuted hover:text-red-400 p-1 rounded-md hover:bg-red-400/10 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-semibold text-sm mb-2 text-gray-100">
                    {snippet.title}
                  </h3>
                  <p className="text-textMuted text-sm whitespace-pre-wrap leading-relaxed">
                    {snippet.text}
                  </p>

                  <div
                    className={`mt-4 text-xs font-semibold transition-all duration-200 flex items-center gap-1
                    ${isCopied ? "opacity-100 text-teal-400 translate-y-0" : "opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 text-gray-500"}`}
                  >
                    {isCopied ? (
                      <>
                        <Check size={14} /> Copied to clipboard
                      </>
                    ) : (
                      "Click to copy"
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>

      {/* SNIPPET MODAL */}
      {isSnippetModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-borderLine rounded-xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold mb-4">
              {editingId ? "Edit Snippet" : "Add New Snippet"}
            </h2>
            <form onSubmit={handleSaveSnippet} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-textMuted mb-1 uppercase tracking-wider">
                  Title
                </label>
                <input
                  type="text"
                  autoFocus
                  className="w-full bg-background border border-borderLine rounded-md px-3 py-2 text-sm focus:outline-none focus:border-teal-500/50"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="block text-xs font-semibold text-textMuted mb-1 uppercase tracking-wider">
                  Category
                </label>
                <select
                  className="w-full bg-background border border-borderLine rounded-md px-3 py-2 text-sm focus:outline-none focus:border-teal-500/50 appearance-none cursor-pointer"
                  value={newCategoryId}
                  onChange={(e) => setNewCategoryId(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    Select a category...
                  </option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                  <option
                    value="CREATE_NEW"
                    className="font-bold text-teal-400"
                  >
                    + Create New Category...
                  </option>
                </select>

                {newCategoryId === "CREATE_NEW" && (
                  <div className="flex gap-2 items-center bg-[#1a1a1a] p-2 rounded-md border border-teal-500/30">
                    <input
                      type="text"
                      placeholder="New category name"
                      className="flex-1 bg-background border border-borderLine rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-teal-500/50"
                      value={inlineCatName}
                      onChange={(e) => setInlineCatName(e.target.value)}
                      required
                    />
                    <input
                      type="color"
                      className="w-8 h-8 p-0 border-0 rounded cursor-pointer bg-transparent"
                      value={inlineCatColor}
                      onChange={(e) => setInlineCatColor(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-textMuted mb-1 uppercase tracking-wider">
                  Snippet Text
                </label>
                <textarea
                  rows={5}
                  className="w-full bg-background border border-borderLine rounded-md px-3 py-2 text-sm focus:outline-none focus:border-teal-500/50 resize-none font-mono"
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  required
                />
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setIsSnippetModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-textMuted hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-white text-black px-4 py-2 rounded-md text-sm font-bold hover:bg-gray-200"
                >
                  {editingId ? "Update" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CATEGORY MANAGER MODAL */}
      {isCatModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-borderLine rounded-xl w-full max-w-md p-6 shadow-2xl flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Settings size={20} className="text-teal-400" /> Manage Categories
            </h2>

            <div className="flex-1 overflow-y-auto mb-6 space-y-2 pr-2">
              {categories.map((cat, index) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between bg-background border border-borderLine rounded-md p-2 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col border-r border-borderLine pr-2">
                      <button
                        onClick={() => moveCategory(index, -1)}
                        disabled={index === 0}
                        className="text-gray-500 hover:text-white disabled:opacity-0 p-0.5 transition-colors"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        onClick={() => moveCategory(index, 1)}
                        disabled={index === categories.length - 1}
                        className="text-gray-500 hover:text-white disabled:opacity-0 p-0.5 transition-colors"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>

                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    ></span>
                    <span className="font-medium text-sm">{cat.name}</span>
                  </div>

                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setEditingCatId(cat.id);
                        setNewCatName(cat.name);
                        setNewCatColor(cat.color);
                      }}
                      className="text-textMuted hover:text-teal-400 p-1 rounded hover:bg-teal-400/10 transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() =>
                        setDeleteAlert({
                          open: true,
                          type: "category",
                          id: cat.id,
                          message: `Delete "${cat.name}"?`,
                          subMessage:
                            "Snippets inside will be moved to the General category.",
                        })
                      }
                      className="text-textMuted hover:text-red-400 p-1 rounded hover:bg-red-400/10 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-borderLine pt-4">
              <h3 className="text-xs font-semibold text-textMuted mb-3 uppercase tracking-wider">
                {editingCatId ? "Edit Category" : "Add New Category"}
              </h3>
              <form onSubmit={handleSaveCategory} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Category Name"
                  className="flex-1 bg-background border border-borderLine rounded-md px-3 py-2 text-sm focus:outline-none focus:border-teal-500/50"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                />
                <input
                  type="color"
                  className="w-10 h-10 p-0 border-0 rounded cursor-pointer bg-transparent"
                  value={newCatColor}
                  onChange={(e) => setNewCatColor(e.target.value)}
                />
                <button
                  type="submit"
                  className="bg-white text-black px-4 py-2 rounded-md text-sm font-bold hover:bg-gray-200"
                >
                  {editingCatId ? "Update" : "Add"}
                </button>
              </form>

              <div className="flex justify-end gap-3 mt-6">
                {editingCatId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCatId(null);
                      setNewCatName("");
                    }}
                    className="px-4 py-2 text-sm font-semibold text-textMuted hover:text-white transition-colors"
                  >
                    Cancel Edit
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsCatModalOpen(false)}
                  className="bg-[#1f1f1f] border border-borderLine px-4 py-2 rounded-md text-sm font-semibold text-white hover:bg-gray-700 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM DELETE CONFIRMATION MODAL */}
      {deleteAlert.open && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-card border border-borderLine rounded-xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold mb-2 text-white">
              {deleteAlert.message}
            </h3>
            <p className="text-textMuted text-sm mb-6">
              {deleteAlert.subMessage}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteAlert({ ...deleteAlert, open: false })}
                className="px-4 py-2 text-sm font-semibold text-textMuted hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2 rounded-md text-sm font-bold hover:bg-red-500 hover:text-white transition-all shadow-[0_0_10px_rgba(239,68,68,0.1)]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
