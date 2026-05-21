import { useState, useEffect, useMemo } from "react";
import {
  writeTextFile,
  readTextFile,
  BaseDirectory,
  exists,
} from "@tauri-apps/plugin-fs";
import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";
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
  GripVertical,
  FileText,
  ClipboardList,
} from "lucide-react";
import { DndContext, rectIntersection, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import logo from "./assets/CopyCat.png";

const FILE_SNIPPETS = "copycat_data.json";
const FILE_CATEGORIES = "copycat_cats.json";
const FILE_NOTES = "copycat_notes.json"; // New local file for Notes
const FILE_SETTINGS = "copycat_settings.json";

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

const defaultNotes = [
  {
    id: "1",
    title: "Scratchpad",
    content: "Drop random ideas and temporary code here...",
    updatedAt: Date.now(),
  },
];

const getDynamicStyle = (hexColor) => {
  const hex = hexColor || "#888888";
  return { color: hex, backgroundColor: `${hex}1A`, borderColor: `${hex}33` };
};

export default function App() {
  // App Navigation
  const [currentView, setCurrentView] = useState("snippets"); // 'snippets' or 'notes'

  // Snippets & Categories State
  const [activeCategoryId, setActiveCategoryId] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [snippets, setSnippets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [overlaySnippet, setOverlaySnippet] = useState(null);
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } });
  const sensors = useSensors(pointerSensor);

  // Notes State
  const [notes, setNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [isNoteEditorOpen, setIsNoteEditorOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [noteTitleDraft, setNoteTitleDraft] = useState("");
  const [noteContentDraft, setNoteContentDraft] = useState("");
  const [isNoteDirty, setIsNoteDirty] = useState(false);
  const [isNoteDiscardOpen, setIsNoteDiscardOpen] = useState(false);

  // Settings
  const [settings, setSettings] = useState({ vanishOnCopy: true, globalShortcutEnabled: true });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState(settings);

  // Modals & Alerts
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

      try {
        if (await exists(FILE_NOTES, { baseDir: BaseDirectory.AppLocalData })) {
          const loadedNotes = JSON.parse(
            await readTextFile(FILE_NOTES, {
              baseDir: BaseDirectory.AppLocalData,
            }),
          );
          setNotes(loadedNotes);
          if (loadedNotes.length > 0) setActiveNoteId(loadedNotes[0].id);
        } else {
          setNotes(defaultNotes);
          setActiveNoteId(defaultNotes[0].id);
        }
      } catch (e) {
        console.error("Error loading notes:", e);
      }

      // Load settings (vanish on copy, global shortcut)
      let loadedSettings = { vanishOnCopy: true, globalShortcutEnabled: true };
      try {
        if (await exists(FILE_SETTINGS, { baseDir: BaseDirectory.AppLocalData })) {
          loadedSettings = JSON.parse(
            await readTextFile(FILE_SETTINGS, { baseDir: BaseDirectory.AppLocalData }),
          );
        } else {
          await writeTextFile(FILE_SETTINGS, JSON.stringify(loadedSettings, null, 2), { baseDir: BaseDirectory.AppLocalData });
        }
        setSettings(loadedSettings);
      } catch (e) {
        console.error("Error loading settings:", e);
      }

      const appWindow = getCurrentWindow();
      unlistenClose = await appWindow.onCloseRequested((e) => {
        e.preventDefault();
        appWindow.hide();
      });

      try {
        if (loadedSettings.globalShortcutEnabled) {
          await register("CommandOrControl+Shift+S", async (e) => {
            if (e.state === "Pressed") {
              await appWindow.show();
              await appWindow.setFocus();
            }
          });
        }
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
      unregisterAll().catch((e) => console.error(e));
    };
  }, []);

  // React to settings changes for the global shortcut (register/unregister)
  useEffect(() => {
    const syncShortcut = async () => {
      try {
        if (settings && settings.globalShortcutEnabled) {
          const appWindow = getCurrentWindow();
          await register("CommandOrControl+Shift+S", async (e) => {
            if (e.state === "Pressed") {
              await appWindow.show();
              await appWindow.setFocus();
            }
          });
        } else {
          await unregisterAll();
        }
      } catch (e) {
        console.error(e);
      }
    };
    syncShortcut();
    return () => {};
  }, [settings?.globalShortcutEnabled]);

  // --- SAVE FUNCTIONS ---
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

  const saveNotesToFile = async (data) => {
    try {
      await writeTextFile(FILE_NOTES, JSON.stringify(data, null, 2), {
        baseDir: BaseDirectory.AppLocalData,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const saveSettings = async (data) => {
    try {
      await writeTextFile(FILE_SETTINGS, JSON.stringify(data, null, 2), {
        baseDir: BaseDirectory.AppLocalData,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const toggleVanishOnCopy = async () => {
    const updated = { ...(settings || {}), vanishOnCopy: !settings.vanishOnCopy };
    setSettings(updated);
    await saveSettings(updated);
  };

  const toggleGlobalShortcut = async () => {
    const updated = { ...(settings || {}), globalShortcutEnabled: !settings.globalShortcutEnabled };
    setSettings(updated);
    await saveSettings(updated);
  };

  const openSettingsModal = () => {
    setSettingsDraft(settings || { vanishOnCopy: true, globalShortcutEnabled: true });
    setIsSettingsOpen(true);
  };

  const saveSettingsFromModal = async () => {
    const updated = settingsDraft || { vanishOnCopy: true, globalShortcutEnabled: true };
    setSettings(updated);
    await saveSettings(updated);
    setIsSettingsOpen(false);
  };

  const cancelSettingsModal = () => {
    setIsSettingsOpen(false);
    setSettingsDraft(settings || { vanishOnCopy: true, globalShortcutEnabled: true });
  };

  // --- NOTES LOGIC ---
  const openNewNoteEditor = () => {
    setEditingNoteId(null);
    setNoteTitleDraft("");
    setNoteContentDraft("");
    setIsNoteDirty(false);
    setIsNoteEditorOpen(true);
  };

  const openEditNoteEditor = (note) => {
    setEditingNoteId(note.id);
    setNoteTitleDraft(note.title || "");
    setNoteContentDraft(note.content || "");
    setActiveNoteId(note.id);
    setIsNoteDirty(false);
    setIsNoteEditorOpen(true);
  };

  const closeNoteEditor = () => {
    if (isNoteDirty) {
      setIsNoteDiscardOpen(true);
      return;
    }

    setIsNoteEditorOpen(false);
    setEditingNoteId(null);
    setNoteTitleDraft("");
    setNoteContentDraft("");
    setIsNoteDirty(false);
  };

  const discardNoteChanges = () => {
    setIsNoteDiscardOpen(false);

    setIsNoteEditorOpen(false);
    setEditingNoteId(null);
    setNoteTitleDraft("");
    setNoteContentDraft("");
    setIsNoteDirty(false);
  };

  const saveNoteDraft = async () => {
    if (!noteTitleDraft.trim() && !noteContentDraft.trim()) return;

    if (editingNoteId) {
      const updatedNotes = notes.map((n) =>
        n.id === editingNoteId
          ? {
              ...n,
              title: noteTitleDraft.trim() || "Untitled Note",
              content: noteContentDraft,
              updatedAt: Date.now(),
            }
          : n,
      );
      setNotes(updatedNotes);
      await saveNotesToFile(updatedNotes);
      setActiveNoteId(editingNoteId);
    } else {
      const newNote = {
        id: Date.now().toString(),
        title: noteTitleDraft.trim() || "Untitled Note",
        content: noteContentDraft,
        updatedAt: Date.now(),
      };
      const updatedNotes = [newNote, ...notes];
      setNotes(updatedNotes);
      await saveNotesToFile(updatedNotes);
      setActiveNoteId(newNote.id);
      setEditingNoteId(newNote.id);
    }

    setIsNoteEditorOpen(false);
    setIsNoteDirty(false);
  };

  const confirmDeleteNote = (id) => {
    setDeleteAlert({
      open: true,
      type: "note",
      id: id,
      message: "Delete this note?",
      subMessage: "This action cannot be undone.",
    });
  };

  // --- SNIPPET & CATEGORY LOGIC ---
  const handleCopy = async (snippet, e) => {
    if (e.target.closest("button")) return;
    try {
      await navigator.clipboard.writeText(snippet.text);
      setCopiedId(snippet.id);
      setTimeout(async () => {
        setCopiedId(null);
        if (settings?.vanishOnCopy) {
          await getCurrentWindow().hide();
        }
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
      saveCategories(
        categories.map((c) =>
          c.id === editingCatId
            ? { ...c, name: newCatName.trim(), color: newCatColor }
            : c,
        ),
      );
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
    } else if (deleteAlert.type === "note") {
      const updatedNotes = notes.filter((n) => n.id !== deleteAlert.id);
      setNotes(updatedNotes);
      saveNotesToFile(updatedNotes);
      if (activeNoteId === deleteAlert.id)
        setActiveNoteId(updatedNotes.length > 0 ? updatedNotes[0].id : null);
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

  const moveSnippet = (snippetId, direction) => {
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

    const mainIdx1 = snippets.findIndex((s) => s.id === snippetId);
    const mainIdx2 = snippets.findIndex(
      (s) => s.id === currentFiltered[targetFilteredIdx].id,
    );

    const newSnippets = [...snippets];
    const temp = newSnippets[mainIdx1];
    newSnippets[mainIdx1] = newSnippets[mainIdx2];
    newSnippets[mainIdx2] = temp;
    saveSnippets(newSnippets);
  };

  const handleDragStartDnd = ({ active }) => {
    const snippet = snippets.find((s) => s.id === active.id);
    setOverlaySnippet(snippet || null);
  };

  const handleDragEndDnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    // only reorder inside a selected category
    if (activeCategoryId === "All") return;

    const currentFiltered = snippets.filter((snippet) => {
      const matchesCat = snippet.categoryId === activeCategoryId;
      const matchesSearch =
        snippet.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        snippet.text.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });

    const oldIndex = currentFiltered.findIndex((s) => s.id === active.id);
    const newIndex = currentFiltered.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newFiltered = arrayMove(currentFiltered, oldIndex, newIndex);

    // Rebuild main snippets array: remove all items from this category and insert reordered block
    const firstIndex = snippets.findIndex((s) => s.categoryId === activeCategoryId);
    const withoutCategory = snippets.filter((s) => s.categoryId !== activeCategoryId);
    const newSnippets = [...withoutCategory];
    if (firstIndex === -1 || firstIndex >= newSnippets.length) {
      newSnippets.push(...newFiltered);
    } else {
      newSnippets.splice(firstIndex, 0, ...newFiltered);
    }

    saveSnippets(newSnippets);
    setOverlaySnippet(null);
  };

  function SortableSnippet({ snippet }) {
    const category = categories.find((c) => c.id === snippet.categoryId);
    const isCopied = copiedId === snippet.id;
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: snippet.id, animateLayoutChanges: () => true });
    const defaultTransition = "transform 180ms cubic-bezier(0.2, 0, 0, 1)";
    const style = {
      transform: CSS.Transform.toString(transform),
      transition: transition || defaultTransition,
      willChange: "transform",
      opacity: isDragging ? 0.35 : 1,
      width: "100%",
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        onClick={(e) => handleCopy(snippet, e)}
        className={`border rounded-lg p-4 cursor-pointer transition-all duration-200 group relative w-full
          ${isCopied ? "bg-[#121c15] border-teal-500/50 shadow-[0_0_15px_rgba(45,212,191,0.1)]" : "bg-card border-borderLine hover:border-gray-500 hover:shadow-lg"}
        `}
      >
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <button {...attributes} {...listeners} className="opacity-60 cursor-grab p-1">
              <GripVertical size={14} />
            </button>
            {category && (
              <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border" style={getDynamicStyle(category.color)}>
                {category.name}
              </span>
            )}
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => openSnippetModal(snippet)} className="text-textMuted hover:text-teal-400 p-1 rounded-md hover:bg-teal-400/10 transition-colors">
              <Edit2 size={14} />
            </button>
            <button onClick={() => setDeleteAlert({ open: true, type: "snippet", id: snippet.id, message: "Delete this snippet?", subMessage: "This action cannot be undone." })} className="text-textMuted hover:text-red-400 p-1 rounded-md hover:bg-red-400/10 transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        <div>
          <h3 className="font-semibold text-sm mb-2 text-gray-100">{snippet.title}</h3>
          <p className="text-textMuted text-sm whitespace-pre-wrap break-words leading-relaxed max-h-64 overflow-auto">{snippet.text}</p>
        </div>
        <div className={`mt-4 text-xs font-semibold transition-all duration-200 flex items-center gap-1 ${isCopied ? "opacity-100 text-teal-400 translate-y-0" : "opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 text-gray-500"}`}>
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
  }

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

  const filteredSnippets = useMemo(() => {
    return snippets.filter((snippet) => {
      const matchesCat =
        activeCategoryId === "All" || snippet.categoryId === activeCategoryId;
      const matchesSearch =
        snippet.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        snippet.text.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [snippets, activeCategoryId, searchQuery]);

  const masonryCols = useMemo(() => {
    const cols = [[], [], []];
    const heights = [0, 0, 0];
    filteredSnippets.forEach((snippet) => {
      const height = 100 + snippet.text.length * 0.5;
      const minIdx = heights.indexOf(Math.min(...heights));
      cols[minIdx].push(snippet);
      heights[minIdx] += height;
    });
    return cols;
  }, [filteredSnippets]);

  const activeNote = notes.find((n) => n.id === activeNoteId);

  return (
    <div className="h-screen w-screen overflow-x-hidden bg-background text-white flex flex-col font-sans selection:bg-teal-500/30 selection:text-white">
      {/* HEADER */}
      <header className="h-16 border-b border-borderLine flex items-center justify-between px-6 shrink-0 bg-background/80 backdrop-blur-md z-10">
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2 text-teal-400">
          <img
            src={logo}
            alt="CopyCat Logo"
            className="w-7 h-7 object-contain drop-shadow-md"
          />
          <span className="text-white">CopyCat</span>
        </h1>

        {currentView === "snippets" && (
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
        )}
        <div className="flex items-center gap-2">
          <button onClick={openSettingsModal} title="Settings" className="p-2 rounded-md text-textMuted hover:text-teal-400 hover:bg-card/10">
            <Settings size={18} />
          </button>
          <button
            onClick={
              currentView === "snippets"
                ? () => openSnippetModal()
                : openNewNoteEditor
            }
            className="bg-white text-black font-semibold px-4 py-1.5 rounded-md text-sm hover:bg-gray-200 transition-colors shadow-[0_0_15px_rgba(255,255,255,0.1)] flex items-center gap-1"
          >
            <Plus size={16} strokeWidth={3} />{" "}
            {currentView === "snippets" ? "New Snippet" : "New Note"}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* CONTEXTUAL SIDEBAR */}
        <aside className="w-56 border-r border-borderLine flex flex-col shrink-0 bg-background z-10">
          {/* VIEW SWITCHER */}
          <div className="p-3 border-b border-borderLine">
            <div className="flex bg-[#121212] p-1 rounded-md border border-borderLine shadow-inner">
              <button
                onClick={() => setCurrentView("snippets")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-sm transition-all ${currentView === "snippets" ? "bg-background text-teal-400 shadow-sm border border-borderLine" : "text-gray-500 hover:text-gray-300"}`}
              >
                <ClipboardList size={14} /> Snippets
              </button>
              <button
                onClick={() => setCurrentView("notes")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-sm transition-all ${currentView === "notes" ? "bg-background text-teal-400 shadow-sm border border-borderLine" : "text-gray-500 hover:text-gray-300"}`}
              >
                <FileText size={14} /> Notes
              </button>
            </div>
          </div>

          {/* SNIPPETS CATEGORIES LIST */}
          {currentView === "snippets" ? (
            <>
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
              <div className="p-4 border-t border-borderLine shrink-0">
                <button
                  onClick={() => {
                    setIsCatModalOpen(true);
                    setEditingCatId(null);
                    setNewCatName("");
                  }}
                  className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-textMuted hover:bg-card hover:text-white transition-all flex items-center gap-2"
                >
                  <Settings size={16} /> Manage Categories
                </button>
                
              </div>
            </>
          ) : (
            /* NOTES LIST */
            <div className="p-3 flex-1 overflow-y-auto flex flex-col gap-2">
              {notes.map((note) => (
                <div
                  key={note.id}
                  onClick={() => setActiveNoteId(note.id)}
                  className={`cursor-pointer rounded-md p-3 text-left transition-all border group ${activeNoteId === note.id ? "bg-card border-teal-500/30 shadow-[0_0_10px_rgba(45,212,191,0.05)]" : "border-transparent hover:bg-card/50"}`}
                >
                  <div className="flex justify-between items-start">
                    <h4
                      className={`text-sm font-semibold truncate pr-2 ${activeNoteId === note.id ? "text-teal-400" : "text-gray-200"}`}
                    >
                      {note.title || "Untitled Note"}
                    </h4>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditNoteEditor(note);
                        }}
                        className="text-gray-600 hover:text-teal-400 p-1 rounded-md hover:bg-teal-400/10 transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmDeleteNote(note.id);
                        }}
                        className="text-gray-600 hover:text-red-400 p-1 rounded-md hover:bg-red-400/10 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-1">
                    {new Date(note.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* MAIN AREA */}
        {currentView === "snippets" ? (
          /* SNIPPETS GRID */
          <main className="flex-1 p-6 overflow-y-auto overflow-x-hidden relative min-w-0">
            {activeCategoryId === "All" ? (
              <div className="flex gap-4 pb-20 min-w-0">
                {masonryCols.map((col, colIdx) => (
                  <div key={colIdx} className="flex-1 min-w-0 flex flex-col gap-4">
                    {col.map((snippet) => {
                      const isCopied = copiedId === snippet.id;
                      const category = categories.find(
                        (c) => c.id === snippet.categoryId,
                      );
                      return (
                        <div
                          key={snippet.id}
                          onClick={(e) => handleCopy(snippet, e)}
                          className={`border rounded-lg p-4 cursor-pointer transition-all duration-200 group relative w-full min-w-0
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
                          <div>
                            <h3 className="font-semibold text-sm mb-2 text-gray-100 break-words">
                              {snippet.title}
                            </h3>
                            <p className="text-textMuted text-sm whitespace-pre-wrap break-words leading-relaxed max-h-64 overflow-auto">
                              {snippet.text}
                            </p>
                          </div>
                          <div
                            className={`mt-4 text-xs font-semibold transition-all duration-200 flex items-center gap-1 ${isCopied ? "opacity-100 text-teal-400 translate-y-0" : "opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 text-gray-500"}`}
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
                ))}
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={rectIntersection}
                onDragStart={handleDragStartDnd}
                onDragEnd={handleDragEndDnd}
              >
                <div className="flex gap-4 pb-20 min-w-0">
                  <SortableContext
                    items={filteredSnippets.map((s) => s.id)}
                    strategy={rectSortingStrategy}
                  >
                    {masonryCols.map((col, colIdx) => (
                      <div key={colIdx} className="flex-1 min-w-0 flex flex-col gap-4">
                        {col.map((snippet) => (
                          <SortableSnippet key={snippet.id} snippet={snippet} />
                        ))}
                      </div>
                    ))}
                  </SortableContext>
                </div>
                <DragOverlay dropAnimation={null}>
                  {overlaySnippet ? (
                    <div className="border rounded-lg p-4 bg-card border-borderLine shadow-2xl max-w-full w-[min(100%,28rem)] pointer-events-none">
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                          <GripVertical size={14} />
                          <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border" style={getDynamicStyle(categories.find((c) => c.id === overlaySnippet.categoryId)?.color)}>
                            {categories.find((c) => c.id === overlaySnippet.categoryId)?.name}
                          </span>
                        </div>
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm mb-2 text-gray-100">{overlaySnippet.title}</h3>
                        <p className="text-textMuted text-sm whitespace-pre-wrap break-words leading-relaxed max-h-64 overflow-auto">{overlaySnippet.text}</p>
                      </div>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}
          </main>
        ) : (
          /* NOTES EDITOR */
          <main className="flex-1 flex flex-col bg-background relative">
            {isNoteEditorOpen ? (
              <div className="flex-1 flex flex-col p-8 max-w-4xl mx-auto w-full h-full">
                <div className="flex items-center justify-between mb-6 gap-4">
                  <input
                    type="text"
                    value={noteTitleDraft}
                      onChange={(e) => {
                        setNoteTitleDraft(e.target.value);
                        setIsNoteDirty(true);
                      }}
                    placeholder="Note Title"
                    className="flex-1 bg-transparent text-3xl font-bold text-white focus:outline-none placeholder:text-gray-700"
                  />
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={closeNoteEditor}
                      className="px-4 py-2 text-sm font-semibold text-textMuted hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={saveNoteDraft}
                      className="bg-white text-black px-4 py-2 rounded-md text-sm font-bold hover:bg-gray-200"
                    >
                      Save
                    </button>
                  </div>
                </div>
                <textarea
                  value={noteContentDraft}
                  onChange={(e) => {
                    setNoteContentDraft(e.target.value);
                    setIsNoteDirty(true);
                  }}
                  placeholder="Start typing your notes here..."
                  className="flex-1 bg-transparent text-gray-300 text-base leading-relaxed focus:outline-none resize-none placeholder:text-gray-700"
                />
              </div>
            ) : activeNote ? (
              <div className="flex-1 flex flex-col p-8 max-w-4xl mx-auto w-full h-full">
                <div className="flex items-start justify-between gap-4 mb-6">
                  <h2 className="text-3xl font-bold text-white break-words">
                    {activeNote.title || "Untitled Note"}
                  </h2>
                  <button
                    onClick={() => openEditNoteEditor(activeNote)}
                    className="text-textMuted hover:text-teal-400 p-2 rounded-md hover:bg-teal-400/10 transition-colors"
                    aria-label="Edit note"
                  >
                    <Edit2 size={16} />
                  </button>
                </div>
                <div className="flex-1 bg-transparent text-gray-300 text-base leading-relaxed whitespace-pre-wrap break-words overflow-y-auto">
                  {activeNote.content || "This note is empty."}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-600 flex-col gap-4">
                <FileText size={48} className="opacity-20" />
                <p>Select a note or create a new one.</p>
              </div>
            )}
          </main>
        )}
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
                  className="flex items-center justify-between bg-background border border-borderLine rounded-md p-2 group transition-all"
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

      {/* SETTINGS MODAL */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-borderLine rounded-xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Settings size={20} className="text-teal-400" /> Settings
            </h2>
            <div className="flex flex-col gap-4 text-sm text-textMuted">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">Vanish after copy</div>
                  <div className="text-xs text-gray-400">Hide window after copying a snippet</div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only" checked={!!settingsDraft?.vanishOnCopy} onChange={(e)=> setSettingsDraft({...settingsDraft, vanishOnCopy: e.target.checked})} />
                    <div className={`w-12 h-7 flex items-center rounded-full p-1 transition-colors ${settingsDraft?.vanishOnCopy ? 'bg-emerald-400' : 'bg-gray-700'}`}>
                      <div className={`bg-white w-5 h-5 rounded-full shadow transform transition-transform ${settingsDraft?.vanishOnCopy ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </label>
                  <span className={`text-sm font-semibold ${settingsDraft?.vanishOnCopy ? 'text-emerald-300' : 'text-gray-400'}`}>{settingsDraft?.vanishOnCopy ? 'On' : 'Off'}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">Global shortcut</div>
                  <div className="text-xs text-gray-400">Toggle Command/Ctrl+Shift+S</div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only" checked={!!settingsDraft?.globalShortcutEnabled} onChange={(e)=> setSettingsDraft({...settingsDraft, globalShortcutEnabled: e.target.checked})} />
                    <div className={`w-12 h-7 flex items-center rounded-full p-1 transition-colors ${settingsDraft?.globalShortcutEnabled ? 'bg-emerald-400' : 'bg-gray-700'}`}>
                      <div className={`bg-white w-5 h-5 rounded-full shadow transform transition-transform ${settingsDraft?.globalShortcutEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </label>
                  <span className={`text-sm font-semibold ${settingsDraft?.globalShortcutEnabled ? 'text-emerald-300' : 'text-gray-400'}`}>{settingsDraft?.globalShortcutEnabled ? 'On' : 'Off'}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={cancelSettingsModal} className="px-4 py-2 text-sm font-semibold text-textMuted hover:text-white transition-colors">Cancel</button>
              <button onClick={saveSettingsFromModal} className="bg-white text-black px-4 py-2 rounded-md text-sm font-bold hover:bg-gray-200">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* NOTE DISCARD CONFIRMATION MODAL */}
      {isNoteDiscardOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-card border border-borderLine rounded-xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold mb-2 text-white">
              Discard unsaved changes?
            </h3>
            <p className="text-textMuted text-sm mb-6">
              You have unsaved note changes. If you close now, those edits will be lost.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsNoteDiscardOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-textMuted hover:text-white transition-colors"
              >
                Keep Editing
              </button>
              <button
                onClick={discardNoteChanges}
                className="bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2 rounded-md text-sm font-bold hover:bg-red-500 hover:text-white transition-all shadow-[0_0_10px_rgba(239,68,68,0.1)]"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
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
