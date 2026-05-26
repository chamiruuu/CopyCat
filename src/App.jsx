import { useState, useEffect, useMemo, useRef } from "react";
import {
  writeTextFile,
  readTextFile,
  BaseDirectory,
  exists,
} from "@tauri-apps/plugin-fs";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Menu } from "@tauri-apps/api/menu";
import { TrayIcon } from "@tauri-apps/api/tray";
import { defaultWindowIcon } from "@tauri-apps/api/app";
import { listen } from "@tauri-apps/api/event";
import { check } from "@tauri-apps/plugin-updater";
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
import {
  DndContext,
  rectIntersection,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
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
const FILE_NOTES = "copycat_notes.json";

const defaultCategories = [
  { id: "1", name: "General", color: "#2dd4bf" },
  { id: "2", name: "Standard Responses", color: "#3b82f6" },
  { id: "3", name: "Quick Replies", color: "#f59e0b" },
];

const defaultSnippets = [
  {
    id: "s1",
    title: "Quick Reply",
    categoryId: "3",
    text: "Hi Sir this is XXX, Please hold on.",
  },
  {
    id: "s2",
    title: "30 minutes delay",
    categoryId: "2",
    text: 'This request have been forwarded to related parties and we shall keep you posted. Please feel free to ask about the latest update.',
  },
];

const defaultNotes = [
  {
    id: "n1",
    title: "Scratchpad",
    content: "Drop temporary steps or notes here...",
    updatedAt: Date.now(),
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

function SortableCategoryItem({
  cat,
  activeCategoryId,
  setActiveCategoryId,
  setEditingCatId,
  setNewCatName,
  setNewCatColor,
  setDeleteAlert,
  draggedCatId,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cat.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between bg-background border rounded-md p-2 group transition-all relative
        ${isDragging || draggedCatId === cat.id ? "opacity-30 border-teal-500/30 bg-[#161616]" : "border-borderLine hover:border-gray-700"}
      `}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-600 hover:text-white transition-colors p-1"
        >
          <GripVertical size={14} />
        </div>
        <button
          type="button"
          onClick={() => setActiveCategoryId(cat.id)}
          className={`flex items-center gap-2 flex-1 text-left text-sm font-medium truncate py-1 px-1 rounded transition-colors
            ${activeCategoryId === cat.id ? "text-teal-400 font-semibold" : "text-textMuted hover:text-white"}`}
        >
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
            style={{ backgroundColor: cat.color }}
          ></span>
          <span className="truncate">{cat.name}</span>
        </button>
      </div>

      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 bg-background pl-1">
        <button
          type="button"
          onClick={() => {
            setEditingCatId(cat.id);
            setNewCatName(cat.name);
            setNewCatColor(cat.color);
          }}
          className="text-textMuted hover:text-teal-400 p-1 rounded hover:bg-teal-400/10 transition-colors"
        >
          <Edit2 size={13} />
        </button>
        <button
          type="button"
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
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function SortableSnippetCard({
  snippet,
  categories,
  openSnippetModal,
  setDeleteAlert,
  copiedId,
  handleCopy,
  draggedSnippetId,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: snippet.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isCopied = copiedId === snippet.id;
  const category = categories.find((c) => c.id === snippet.categoryId);

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => handleCopy(snippet, e)}
      className={`border rounded-lg p-4 cursor-pointer transition-all duration-200 group relative bg-card flex flex-col justify-between h-full min-h-[140px]
        ${isDragging || draggedSnippetId === snippet.id ? "opacity-30 border-teal-500/40 bg-[#141414] shadow-none" : ""}
        ${isCopied ? "bg-[#121c15] border-teal-500/50 shadow-[0_0_15px_rgba(45,212,191,0.1)]" : "border-borderLine hover:border-gray-500 hover:shadow-lg"}
      `}
    >
      <div>
        <div className="flex justify-between items-start gap-2 mb-3">
          {category ? (
            <span
              className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border truncate max-w-[120px]"
              style={getDynamicStyle(category.color)}
            >
              {category.name}
            </span>
          ) : (
            <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border border-gray-800 text-gray-500 bg-gray-900/20">
              General
            </span>
          )}

          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 bg-card rounded p-0.5 z-10">
            <div
              {...attributes}
              {...listeners}
              className="drag-handle cursor-grab active:cursor-grabbing text-gray-500 hover:text-white p-1 rounded transition-colors"
            >
              <GripVertical size={14} />
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openSnippetModal(snippet);
              }}
              className="text-textMuted hover:text-teal-400 p-1 rounded hover:bg-teal-400/10 transition-colors"
            >
              <Edit2 size={14} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteAlert({
                  open: true,
                  type: "snippet",
                  id: snippet.id,
                  message: "Delete this snippet?",
                  subMessage: "This action cannot be undone.",
                });
              }}
              className="text-textMuted hover:text-red-400 p-1 rounded hover:bg-red-400/10 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        <h3 className="font-semibold text-sm mb-1.5 text-gray-100 line-clamp-2">
          {snippet.title}
        </h3>
        <p className="text-textMuted text-xs font-mono whitespace-pre-wrap leading-relaxed line-clamp-4 overflow-hidden pointer-events-none">
          {snippet.text}
        </p>
      </div>

      <div
        className={`mt-3 text-[11px] font-semibold transition-all duration-200 flex items-center gap-1 shrink-0
          ${isCopied ? "opacity-100 text-teal-400 translate-y-0" : "opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 text-gray-500"}`}
      >
        {isCopied ? (
          <>
            <Check size={12} /> Copied to clipboard
          </>
        ) : (
          "Click card to copy"
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [currentView, setCurrentView] = useState("snippets");

  const [activeCategoryId, setActiveCategoryId] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [snippets, setSnippets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [copiedId, setCopiedId] = useState(null);

  const [notes, setNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [tempNote, setTempNote] = useState(null);
  const notesRef = useRef([]);

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

  const [draggedSnippetId, setDraggedSnippetId] = useState(null);
  const [draggedCatId, setDraggedCatId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4,
      },
    }),
  );

  useEffect(() => {
    const handleContextMenu = (e) => e.preventDefault();
    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    if (activeNote) {
      setTempNote(activeNote);
      setIsEditing(false);
    } else {
      setTempNote(null);
      setIsEditing(false);
    }
  }, [activeNoteId, notes]);

  useEffect(() => {
    let unlistenClose;
    let unlistenTrayCopy;

    async function initApp() {
      await handleUpdate();

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
      if (unlistenTrayCopy) unlistenTrayCopy.then((fn) => fn());
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

  const saveNotesToFile = async (data) => {
    try {
      await writeTextFile(FILE_NOTES, JSON.stringify(data, null, 2), {
        baseDir: BaseDirectory.AppLocalData,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdate = async () => {
    try {
      const update = await check();
      if (update?.available) {
        console.log(`New version found: ${update.version}. Downloading...`);
        await update.downloadAndInstall();
      }
    } catch (updateError) {
      console.error("Failed to check for system updates:", updateError);
    }
  };

  const handleAddNote = () => {
    const newNote = {
      id: Date.now().toString(),
      title: "Untitled Note",
      content: "",
      updatedAt: Date.now(),
    };
    const updatedNotes = [newNote, ...notes];
    setNotes(updatedNotes);
    saveNotesToFile(updatedNotes);
    setActiveNoteId(newNote.id);
  };

  const updateActiveNote = (field, value) => {
    setNotes((prevNotes) => {
      const updatedNotes = prevNotes.map((n) =>
        n.id === activeNoteId
          ? { ...n, [field]: value, updatedAt: Date.now() }
          : n,
      );
      notesRef.current = updatedNotes;
      return updatedNotes;
    });
  };

  const handleNoteBlur = () => {
    saveNotesToFile(notesRef.current);
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

  const handleCopy = async (snippet, e) => {
    if (e.target.closest("button") || e.target.closest(".drag-handle")) return;
    try {
      await navigator.clipboard.writeText(snippet.text);
      setCopiedId(snippet.id);

      setTimeout(async () => {
        setCopiedId(null);
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
          id: "sn_" + Date.now(),
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
    const colHeights = [0, 0, 0];
    filteredSnippets.forEach((snippet) => {
      const height = 120 + snippet.text.length * 0.4;
      const minIdx = colHeights.indexOf(Math.min(...colHeights));
      cols[minIdx].push(snippet);
      colHeights[minIdx] += height;
    });
    return cols;
  }, [filteredSnippets]);

  const handleDragStart = (event) => {
    const { active } = event;
    if (
      active.id.toString().startsWith("sn_") ||
      active.id.toString() === "s1" ||
      active.id.toString() === "s2"
    ) {
      setDraggedSnippetId(active.id);
    } else {
      setDraggedCatId(active.id);
    }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setDraggedSnippetId(null);
    setDraggedCatId(null);

    if (!over || active.id === over.id) return;

    if (
      draggedSnippetId ||
      active.id.toString().startsWith("sn_") ||
      active.id.toString() === "s1" ||
      active.id.toString() === "s2"
    ) {
      const oldIndex = snippets.findIndex((s) => s.id === active.id);
      const newIndex = snippets.findIndex((s) => s.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        saveSnippets(arrayMove(snippets, oldIndex, newIndex));
      }
    } else {
      const oldIndex = categories.findIndex((c) => c.id === active.id);
      const newIndex = categories.findIndex((c) => c.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        saveCategories(arrayMove(categories, oldIndex, newIndex));
      }
    }
  };

  const activeNote = notes.find((n) => n.id === activeNoteId);

  const saveActiveNote = () => {
    if (!tempNote || !activeNote) return;

    const updatedNotes = notes.map((note) =>
      note.id === activeNote.id
        ? {
            ...note,
            title: tempNote.title,
            content: tempNote.content,
            updatedAt: Date.now(),
          }
        : note,
    );

    setNotes(updatedNotes);
    notesRef.current = updatedNotes;
    saveNotesToFile(updatedNotes);
    setIsEditing(false);
  };

  const activeSnippetItem = useMemo(() => {
    return snippets.find((s) => s.id === draggedSnippetId);
  }, [snippets, draggedSnippetId]);

  const activeCategoryItem = useMemo(() => {
    return categories.find((c) => c.id === draggedCatId);
  }, [categories, draggedCatId]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-white flex flex-col font-sans selection:bg-teal-500/30 selection:text-white">
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

        <button
          onClick={
            currentView === "snippets"
              ? () => openSnippetModal()
              : handleAddNote
          }
          className="bg-white text-black font-semibold px-4 py-1.5 rounded-md text-sm hover:bg-gray-200 transition-colors shadow-[0_0_15px_rgba(255,255,255,0.1)] flex items-center gap-1"
        >
          <Plus size={16} strokeWidth={3} />{" "}
          {currentView === "snippets" ? "New Snippet" : "New Note"}
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-56 border-r border-borderLine flex flex-col shrink-0 bg-background z-10">
          <div className="p-3 border-b border-borderLine">
            <div className="flex bg-[#121212] p-1 rounded-md border border-borderLine shadow-inner">
              <button
                onClick={() => setCurrentView("snippets")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-sm transition-all
                  ${currentView === "snippets" ? "bg-background text-teal-400 shadow-sm border border-borderLine" : "text-gray-500 hover:text-gray-300"}`}
              >
                <ClipboardList size={14} /> Snippets
              </button>
              <button
                onClick={() => setCurrentView("notes")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-sm transition-all
                  ${currentView === "notes" ? "bg-background text-teal-400 shadow-sm border border-borderLine" : "text-gray-500 hover:text-gray-300"}`}
              >
                <FileText size={14} /> Notes
              </button>
            </div>
          </div>

          {currentView === "snippets" ? (
            <DndContext
              sensors={sensors}
              collisionDetection={rectIntersection}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-1">
                <button
                  onClick={() => setActiveCategoryId("All")}
                  className={`text-left px-3 py-2 rounded-md text-sm font-medium transition-all mb-2
                    ${activeCategoryId === "All" ? "bg-teal-500/10 text-teal-400 border border-teal-500/20" : "text-textMuted hover:bg-card hover:text-white border border-transparent"}`}
                >
                  All Categories
                </button>
                <SortableContext
                  items={categories.map((c) => c.id)}
                  strategy={rectSortingStrategy}
                >
                  <div className="space-y-1.5">
                    {categories.map((cat) => (
                      <SortableCategoryItem
                        key={cat.id}
                        cat={cat}
                        activeCategoryId={activeCategoryId}
                        setActiveCategoryId={setActiveCategoryId}
                        setEditingCatId={setEditingCatId}
                        setNewCatName={setNewCatName}
                        setNewCatColor={setNewCatColor}
                        setDeleteAlert={setDeleteAlert}
                        draggedCatId={draggedCatId}
                      />
                    ))}
                  </div>
                </SortableContext>
              </div>
              <div className="p-4 border-t border-borderLine shrink-0">
                <button
                  onClick={() => {
                    setIsCatModalOpen(true);
                    setEditingCatId(null);
                    setNewCatName("");
                  }}
                  className="w-full text-left px-3 py-2 rounded-md text-xs font-medium text-textMuted hover:bg-card hover:text-white transition-all flex items-center gap-2 border border-dashed border-borderLine hover:border-gray-600"
                >
                  <Plus size={14} /> Add Category
                </button>
              </div>
              <DragOverlay>
                {draggedCatId && activeCategoryItem ? (
                  <div className="flex items-center justify-between bg-card border border-teal-500/40 rounded-md p-2 shadow-2xl opacity-90 scale-105">
                    <div className="flex items-center gap-2">
                      <GripVertical size={14} className="text-teal-400" />
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: activeCategoryItem.color }}
                      ></span>
                      <span className="text-sm font-medium">
                        {activeCategoryItem.name}
                      </span>
                    </div>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          ) : (
            <div className="p-3 flex-1 overflow-y-auto flex flex-col gap-1.5">
              {notes.map((note) => (
                <div
                  key={note.id}
                  onClick={() => setActiveNoteId(note.id)}
                  className={`cursor-pointer rounded-md p-3 text-left transition-all border group relative
                    ${activeNoteId === note.id ? "bg-card border-teal-500/30 shadow-[0_0_10px_rgba(45,212,191,0.05)]" : "border-transparent hover:bg-card/40"}`}
                >
                  <div className="flex justify-between items-start">
                    <h4
                      className={`text-sm font-semibold truncate pr-6 ${activeNoteId === note.id ? "text-teal-400" : "text-gray-200"}`}
                    >
                      {note.title || "Untitled Note"}
                    </h4>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        confirmDeleteNote(note.id);
                      }}
                      className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity absolute right-3 top-3.5"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500 truncate mt-1">
                    {new Date(note.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </aside>

        {currentView === "snippets" ? (
          <DndContext
            sensors={sensors}
            collisionDetection={rectIntersection}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <main className="flex-1 p-6 overflow-y-auto relative">
              <div className="flex gap-4 pb-20">
                {masonryCols.map((col, colIdx) => (
                  <div key={colIdx} className="flex-1 flex flex-col gap-4">
                    <SortableContext
                      items={col.map((s) => s.id)}
                      strategy={rectSortingStrategy}
                    >
                      {col.map((snippet) => (
                        <SortableSnippetCard
                          key={snippet.id}
                          snippet={snippet}
                          categories={categories}
                          openSnippetModal={openSnippetModal}
                          setDeleteAlert={setDeleteAlert}
                          copiedId={copiedId}
                          handleCopy={handleCopy}
                          draggedSnippetId={draggedSnippetId}
                        />
                      ))}
                    </SortableContext>
                  </div>
                ))}
              </div>
            </main>
            <DragOverlay>
              {draggedSnippetId && activeSnippetItem ? (
                <div className="border border-teal-500/50 rounded-lg p-4 bg-[#141d17]/90 shadow-2xl scale-105 opacity-90 backdrop-blur-sm pointer-events-none min-h-[140px] w-[280px]">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border border-teal-500/20 text-teal-400 bg-teal-500/5">
                      Sorting...
                    </span>
                  </div>
                  <h3 className="font-semibold text-sm mb-1.5 text-gray-100 truncate">
                    {activeSnippetItem.title}
                  </h3>
                  <p className="text-textMuted text-xs font-mono line-clamp-3 overflow-hidden">
                    {activeSnippetItem.text}
                  </p>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <main className="flex-1 flex flex-col bg-background relative">
            {activeNote ? (
              <div className="flex-1 flex flex-col p-8 max-w-4xl mx-auto w-full h-full">
                <div className="flex justify-between items-center mb-6 gap-3">
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={isEditing ? tempNote?.title ?? "" : activeNote.title}
                    onChange={(e) =>
                      setTempNote((prev) => ({
                        ...(prev ?? activeNote),
                        title: e.target.value,
                      }))
                    }
                    onBlur={!isEditing ? handleNoteBlur : undefined}
                    placeholder="Note Title"
                    className={`bg-transparent text-3xl font-bold text-white focus:outline-none placeholder:text-gray-700 flex-1 ${!isEditing ? "cursor-default" : "border-b border-teal-500/50"}`}
                  />
                  <div className="flex gap-2 shrink-0">
                    {!isEditing ? (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditing(true);
                          setTempNote(activeNote);
                        }}
                        className="text-textMuted hover:text-teal-400 p-2 transition-colors"
                      >
                        <Edit2 size={20} />
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={saveActiveNote}
                          className="text-teal-400 hover:text-teal-300 p-2 transition-colors"
                        >
                          <Check size={20} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditing(false);
                            setTempNote(activeNote);
                          }}
                          className="text-red-400 hover:text-red-300 p-2 transition-colors"
                        >
                          <Trash2 size={20} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <textarea
                  disabled={!isEditing}
                  value={isEditing ? tempNote?.content ?? "" : activeNote.content}
                  onChange={(e) =>
                    setTempNote((prev) => ({
                      ...(prev ?? activeNote),
                      content: e.target.value,
                    }))
                  }
                  onBlur={!isEditing ? handleNoteBlur : undefined}
                  placeholder="Start typing your notes here..."
                  className={`flex-1 bg-transparent text-gray-300 text-sm leading-relaxed focus:outline-none resize-none font-sans ${!isEditing ? "cursor-default" : ""}`}
                />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-600 flex-col gap-4">
                <FileText size={48} className="opacity-10" />
                <p className="text-sm">Select a note or create a new one.</p>
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
            <div className="flex-1 overflow-y-auto mb-6 pr-1 space-y-2">
              <div className="border border-borderLine bg-[#121212] p-3 rounded-md">
                <h3 className="text-xs font-semibold text-textMuted mb-3 uppercase tracking-wider">
                  {editingCatId ? "Edit Category" : "Create New Category"}
                </h3>
                <form onSubmit={handleSaveCategory} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Category Name"
                    className="flex-1 bg-background border border-borderLine rounded-md px-3 py-2 text-sm focus:outline-none focus:border-teal-500/50"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    required
                  />
                  <input
                    type="color"
                    className="w-10 h-10 p-0 border-0 rounded cursor-pointer bg-transparent shrink-0"
                    value={newCatColor}
                    onChange={(e) => setNewCatColor(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="bg-teal-400 text-black px-4 py-2 rounded-md text-sm font-bold hover:bg-teal-300 transition-colors shrink-0"
                  >
                    {editingCatId ? "Update" : "Add"}
                  </button>
                </form>
                {editingCatId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCatId(null);
                      setNewCatName("");
                      setNewCatColor("#2dd4bf");
                    }}
                    className="text-xs text-textMuted hover:text-white mt-2 transition-colors block"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              <div className="mt-6 border-t border-borderLine pt-4 space-y-3">
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-borderLine pt-4">
              <button
                type="button"
                onClick={() => setIsCatModalOpen(false)}
                className="bg-[#1f1f1f] border border-borderLine px-5 py-2 rounded-md text-sm font-semibold text-white hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DISCARD/DELETE CONFIRMATION MODAL */}
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
