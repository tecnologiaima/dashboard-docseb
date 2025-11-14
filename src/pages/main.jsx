// src/components/DashboardMain.jsx
import { useState, useMemo, useEffect } from "react";
import { computeIkdcScore } from "../utils/ikdcScore";
import { lysholmQuestions, tegnerQuestion } from "../data/lysholmTegner";
import { computeLysholmScore, interpretLysholm, findTegnerLabel } from "../utils/lysholmTegner";
import { WOMAC_QUESTIONS, SECTION_HEADINGS } from "../data/womac";
import { computeWomacScores, severityLabel } from "../utils/womacScore";
import {
  IKS_PAIN_OPTIONS,
  IKS_STABILITY_AP_OPTIONS,
  IKS_STABILITY_ML_OPTIONS,
  IKS_WALK_OPTIONS,
  IKS_STAIRS_OPTIONS,
  IKS_AIDS_DEDUCTIONS,
  IKS_SECTIONS,
} from "../data/iks";
import { computeIksScores, pointsFromFlexion, deductionFromFlexionContracture, deductionFromActiveExtensionDeficit, deductionFromAlignment } from "../utils/iksScore";
import { KOOS_QUESTIONS, KOOS_SECTIONS } from "../data/koos";
import { computeKoosScores } from "../utils/koosScore";
import ChatMain from "./chat";

const FORM_FIELD_MAP = {
  IKDC: "ikdc",
  "LYSHOLM-TEGNER": "lysholm-tegner",
  WOMAC: "womac",
  IKS: "iks",
  KOOS: "koos",
};

const OPTIONS = Object.keys(FORM_FIELD_MAP);
const DETAIL_FORMS = new Set(["IKDC", "LYSHOLM-TEGNER", "IKS", "WOMAC", "KOOS"]);

export const ikdcQuestions = [
  {
    id: "q1_activity_without_pain",
    text: "¿Cuál es el nivel más alto de actividad que puede realizar sin sentir dolor en la rodilla?",
    type: "radio",
    options: [
      { label: "Actividades muy agotadoras (saltar/girar, básquet/fútbol)", value: 4 },
      { label: "Actividades agotadoras (trabajo físico pesado, esquiar/tenis)", value: 3 },
      { label: "Actividades moderadas (correr/jogging, trabajo moderado)", value: 2 },
      { label: "Actividades ligeras (caminar, tareas en casa/jardín)", value: 1 },
      { label: "No puedo realizar ninguna de las anteriores por dolor", value: 0 },
    ],
  },
  {
    id: "q2_pain_frequency",
    text: "Durante las últimas 4 semanas o desde la lesión, ¿con cuánta frecuencia ha tenido dolor? (Nunca = 10, Constantemente = 0)",
    type: "scale10",
    min: 0,
    max: 10,
    minLabel: "Constantemente (0)",
    maxLabel: "Nunca (10)",
  },
  {
    id: "q3_pain_intensity",
    text: "Marque la intensidad del dolor (Ningún dolor = 10, Peor dolor imaginable = 0)",
    type: "scale10",
    min: 0,
    max: 10,
    minLabel: "Peor dolor (0)",
    maxLabel: "Ningún dolor (10)",
  },
  {
    id: "q4_stiffness_swelling",
    text: "Durante las últimas 4 semanas, ¿qué tan rígida o hinchada estuvo su rodilla?",
    type: "radio",
    options: [
      { label: "Nada", value: 4 },
      { label: "Poco", value: 3 },
      { label: "Moderadamente", value: 2 },
      { label: "Mucho", value: 1 },
      { label: "Muchísimo", value: 0 },
    ],
  },
  {
    id: "q5_activity_without_swelling",
    text: "¿Cuál es el nivel más alto de actividad que puede realizar sin que la rodilla se hinche de forma considerable?",
    type: "radio",
    options: [
      { label: "Actividades muy agotadoras (saltar/girar…)", value: 4 },
      { label: "Actividades agotadoras (trabajo físico pesado…)", value: 3 },
      { label: "Actividades moderadas (correr/jogging…)", value: 2 },
      { label: "Actividades ligeras (caminar, tareas en casa…)", value: 1 },
      { label: "No puedo realizar ninguna de las anteriores", value: 0 },
    ],
  },
  {
    id: "q6_locking",
    text: "Durante las últimas 4 semanas, ¿se le ha bloqueado/trabado temporalmente la rodilla?",
    type: "radio",
    options: [
      { label: "Sí", value: 0 },
      { label: "No", value: 1 },
    ],
  },
  {
    id: "q7_activity_without_giving_way",
    text: "¿Cuál es el nivel más alto de actividad que puede hacer sin que la rodilla le falle?",
    type: "radio",
    options: [
      { label: "Actividades muy agotadoras (saltar/girar…)", value: 4 },
      { label: "Actividades agotadoras (trabajo físico pesado…)", value: 3 },
      { label: "Actividades moderadas (correr/jogging…)", value: 2 },
      { label: "Actividades ligeras (caminar, tareas en casa…)", value: 1 },
      { label: "No puedo realizar ninguna de las anteriores", value: 0 },
    ],
  },
  {
    id: "q8_highest_regular_activity",
    text: "¿Cuál es el nivel más alto de actividad que puede efectuar de forma habitual?",
    type: "radio",
    options: [
      { label: "Actividades muy agotadoras", value: 4 },
      { label: "Actividades agotadoras", value: 3 },
      { label: "Actividades moderadas", value: 2 },
      { label: "Actividades ligeras", value: 1 },
      { label: "No puedo realizar ninguna de las anteriores", value: 0 },
    ],
  },
  ...[
    ["q9a_stairs_up", "Subir escaleras"],
    ["q9b_stairs_down", "Bajar escaleras"],
    ["q9c_kneeling", "Arrodillarse sobre la parte delantera de la rodilla"],
    ["q9d_squatting", "Ponerse en cuclillas"],
    ["q9e_sitting_bent", "Sentarse con la rodilla doblada"],
    ["q9f_stand_from_chair", "Levantarse de una silla"],
    ["q9g_run_straight", "Correr hacia delante en línea recta"],
    ["q9h_jump_land", "Saltar y caer sobre la pierna afectada"],
    ["q9i_stop_start", "Parar y comenzar rápidamente a caminar o correr"],
  ].map(([id, label]) => ({
    id,
    text: `Debido a su rodilla, nivel de dificultad para: ${label}`,
    type: "radio",
    options: [
      { label: "Ninguna dificultad", value: 4 },
      { label: "Dificultad mínima", value: 3 },
      { label: "Dificultad moderada", value: 2 },
      { label: "Sumamente difícil", value: 1 },
      { label: "No puedo hacerlo", value: 0 },
    ],
  })),
  {
    id: "q10a_function_pre_injury",
    text: "Funcionamiento de su rodilla ANTES de la lesión (0 = nulo, 10 = óptimo) — *No se usa para el cálculo final*",
    type: "scale10",
    min: 0,
    max: 10,
    minLabel: "0 (nulo)",
    maxLabel: "10 (óptimo)",
    excludeFromScore: true,
  },
  {
    id: "q10b_function_current",
    text: "Funcionamiento ACTUAL de su rodilla (0 = nulo, 10 = óptimo)",
    type: "scale10",
    min: 0,
    max: 10,
    minLabel: "0 (nulo)",
    maxLabel: "10 (óptimo)",
  },
];

const IKDC_SCORABLE_COUNT = ikdcQuestions.filter((q) => !q.excludeFromScore).length;
// Base y rutas
const BASE_URL = "https://docseb.preguntaleaima.com";
const ROUTES = {
  IKDC: "/IKDC",
  "LYSHOLM-TEGNER": "/LYSHOLM-TEGNER",
  WOMAC: "/WOMAC",
  IKS: "/IKS",
  KOOS: "/KOOS",
};

const RECORDS_ENDPOINT = "https://get-forms-229745866329.northamerica-south1.run.app";

const TABLE_COLUMNS = [
  { key: "email", label: "Email" },
  { key: "nombre", label: "Nombre" },
  { key: "sexo", label: "Sexo" },
  { key: "fechaNacimiento", label: "Fecha de nacimiento" },
  { key: "operado", label: "¿Operado?" },
  ...OPTIONS.map((f) => ({ key: f, label: f })),
  { key: "detalles", label: "Detalles" },
];

// Claves que deben ir centradas (thead y tbody)
const CENTER_KEYS = new Set(["sexo", "fechaNacimiento", "operado", ...OPTIONS, "detalles"]);

// Anchos fijos por columna
const COL_WIDTHS = [
  260, // Email (izq)
  180, // Nombre (izq)
  70,  // Sexo (centro)
  170, // Fecha de nacimiento (centro)
  110, // ¿Operado? (centro)
  110, // IKDC (centro)
  150, // LYSHOLM-TEGNER (centro)
  110, // WOMAC (centro)
  110, // IKS (centro)
  110, // KOOS (centro)
  110, // detalles (centro)
];

const TRUNCATE_STYLE = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const buildRowsFromApi = (records = []) =>
  records.map((raw, index) => {
    const general = raw?.general ?? {};
    const normalizedForms = {};
    const formDetails = {};

    OPTIONS.forEach((option) => {
      const apiKey = FORM_FIELD_MAP[option];
      const formEntries = Array.isArray(raw?.[apiKey]) ? raw[apiKey] : [];
      normalizedForms[option] = formEntries.length > 0;
      formDetails[option] = formEntries;
    });

    const fallbackEmail = raw?.email ?? general.email ?? "—";

    return {
      id: raw?.id ?? general.id ?? raw?.email ?? general.email ?? `row-${index}`,
      email: fallbackEmail,
      nombre: general.name ?? "—",
      sexo: general.sex ?? "—",
      fechaNacimiento: general.birthdate ?? "—",
      operado: Boolean(general.hasSurgery),
      records: normalizedForms,
      formDetails,
    };
  });

const formatSexForDisplay = (value) => {
  if (typeof value !== "string") return "—";
  const trimmed = value.trim();
  if (!trimmed || trimmed === "—") return "—";
  return trimmed[0].toUpperCase();
};

const formatTimestamp = (timestamp) => {
  if (!timestamp || typeof timestamp._seconds !== "number") return "—";
  const milliseconds = timestamp._seconds * 1000 + Math.floor((timestamp._nanoseconds ?? 0) / 1_000_000);
  const date = new Date(milliseconds);
  return date.toLocaleString("es-MX", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatAnswerValue = (question, value) => {
  if (value === undefined || value === null || value === "") return "Sin respuesta";

  if (question.type === "radio" && Array.isArray(question.options)) {
    const option = question.options.find((opt) => opt.value === value);
    if (option) return option.label;
  }

  if (question.type === "scale10") {
    return `${value} / ${question.max ?? 10}`;
  }

  return `${value}`;
};

const formatPtsLabel = (pts) => {
  if (typeof pts !== "number" || Number.isNaN(pts)) return "";
  const hasSign = pts > 0 ? `+${pts}` : `${pts}`;
  return ` (${hasSign} pts)`;
};

const formatOptionWithPoints = (options = [], value) => {
  if (value === undefined || value === null) return "Sin respuesta";
  const option = options.find((opt) => opt.value === value);
  const label = option?.label ?? `${value}`;
  const suffix = typeof value === "number" ? formatPtsLabel(value) : "";
  return `${label}${suffix}`;
};

const buildIksDetails = (entry) => {
  if (!entry) return { questionAnswers: null, iksScore: null };
  const align = {
    degrees: entry.alignDegrees ?? entry.alignDeg ?? null,
    other: Boolean(entry.alignOther),
  };
  const iksInput = { ...entry, align };
  const iksScore = computeIksScores(iksInput);

  const contractDed = deductionFromFlexionContracture(entry.contractureDeg ?? 0);
  const extensionDed = deductionFromActiveExtensionDeficit(entry.extDefDeg ?? 0);
  const alignmentDed = deductionFromAlignment(align);

  const questionAnswers = [];
  const addQA = (id, text, answer, sectionKey = "knee") => {
    questionAnswers.push({
      id,
      text,
      answer,
      sectionMeta: IKS_SECTIONS[sectionKey] ?? null,
    });
  };

  addQA("painPts", "Dolor", formatOptionWithPoints(IKS_PAIN_OPTIONS, entry.painPts));
  addQA(
    "flexDeg",
    "Flexión activa máxima",
    typeof entry.flexDeg === "number"
      ? `${entry.flexDeg}°${formatPtsLabel(iksScore.mobilityPts)}`
      : "Sin respuesta",
  );
  addQA("apPts", "Estabilidad anteroposterior", formatOptionWithPoints(IKS_STABILITY_AP_OPTIONS, entry.apPts));
  addQA("mlPts", "Estabilidad medio-lateral", formatOptionWithPoints(IKS_STABILITY_ML_OPTIONS, entry.mlPts));
  addQA(
    "contractureDeg",
    "Contractura en flexión",
    typeof entry.contractureDeg === "number"
      ? `${entry.contractureDeg}°${formatPtsLabel(contractDed)}`
      : "Sin respuesta",
  );
  addQA(
    "extDefDeg",
    "Déficit de extensión activa",
    typeof entry.extDefDeg === "number"
      ? `${entry.extDefDeg}°${formatPtsLabel(extensionDed)}`
      : "Sin respuesta",
  );
  addQA(
    "alignment",
    "Alineación anatómica",
    align.other
      ? `Otra deformidad${formatPtsLabel(alignmentDed)}`
      : typeof align.degrees === "number"
        ? `${align.degrees}°${formatPtsLabel(alignmentDed)}`
        : "Sin respuesta",
  );

  addQA("walkPts", "Marcha", formatOptionWithPoints(IKS_WALK_OPTIONS, entry.walkPts), "function");
  addQA("stairsPts", "Escaleras", formatOptionWithPoints(IKS_STAIRS_OPTIONS, entry.stairsPts), "function");
  addQA("aidsDeduction", "Uso de ayudas", formatOptionWithPoints(IKS_AIDS_DEDUCTIONS, entry.aidsDeduction), "function");

  return { questionAnswers, iksScore };
};

const buildKoosDetails = (entry) => {
  if (!entry) return { questionAnswers: null, scores: null };
  const questionAnswers = KOOS_QUESTIONS.map((question) => ({
    id: question.id,
    text: question.text,
    answer: formatAnswerValue(question, entry[question.id]),
    sectionMeta: KOOS_SECTIONS[question.section],
  }));
  const scores = computeKoosScores(entry, KOOS_QUESTIONS);
  return { questionAnswers, scores };
};

// Iconos
function EyeIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" style={{ display: "block" }}>
      <path d="M12 5C7 5 2.73 8.11 1 12c1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-2.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" fill={color} />
    </svg>
  );
}
function CheckIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" style={{ display: "block" }}>
      <path d="M9.0 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z" fill={color} />
    </svg>
  );
}
function XIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" style={{ display: "block" }}>
      <path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3 1.4 1.4Z" fill={color} />
    </svg>
  );
}
function DotsIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" style={{ display: "block" }}>
      <circle cx="6" cy="12" r="1.6" fill={color} />
      <circle cx="12" cy="12" r="1.6" fill={color} />
      <circle cx="18" cy="12" r="1.6" fill={color} />
    </svg>
  );
}

export default function DashboardMain({ palette }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [copyState, setCopyState] = useState("idle");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formDetailModal, setFormDetailModal] = useState(null);
  const [historicalModal, setHistoricalModal] = useState(null);
  const [openRowMenu, setOpenRowMenu] = useState(null);
  const [chatModal, setChatModal] = useState(null);

  useEffect(() => {
    let active = true;

    const fetchRecords = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(RECORDS_ENDPOINT);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        if (!active) return;
        if (!data?.ok) {
          throw new Error("La API respondió sin ok");
        }

        const normalizedRows = buildRowsFromApi(Array.isArray(data.records) ? data.records : []);
        setRows(normalizedRows);
      } catch (err) {
        if (!active) return;
        console.error("Error al cargar registros", err);
        setError("No se pudieron cargar los registros.");
        setRows([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchRecords();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!openRowMenu) return undefined;
    const doc = typeof document !== "undefined" ? document : null;
    const win = typeof window !== "undefined" ? window : null;
    if (!doc || !win) return undefined;

    const handleClickOutside = (event) => {
      const isTrigger = event.target.closest?.('[data-row-menu-trigger="true"]');
      const isPanel = event.target.closest?.('[data-row-menu-panel="true"]');
      if (!isTrigger && !isPanel) {
        setOpenRowMenu(null);
      }
    };
    const handleCloseOnMove = () => setOpenRowMenu(null);

    doc.addEventListener("mousedown", handleClickOutside);
    win.addEventListener("resize", handleCloseOnMove);
    win.addEventListener("scroll", handleCloseOnMove, true);

    return () => {
      doc.removeEventListener("mousedown", handleClickOutside);
      win.removeEventListener("resize", handleCloseOnMove);
      win.removeEventListener("scroll", handleCloseOnMove, true);
    };
  }, [openRowMenu]);

  const toggleOption = (name) => {
    setCopyState("idle");
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // Texto WhatsApp
  const whatsappText = useMemo(() => {
    const items = OPTIONS.filter((n) => selected.has(n));
    const header = "Hola 👋, te comparto los formularios para llenar:";
    const body =
      items.length > 0
        ? items.map((n, i) => `${i + 1}. ${n} (${BASE_URL}${ROUTES[n] ?? ""})`).join("\n")
        : "— (aún no seleccionas ningún formulario)";
    const footer = "\n\nCuando los completes, por favor avísame. Gracias 🙌";
    return `${header}\n\n${body}${footer}`;
  }, [selected]);

  const copyToClipboard = async () => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(whatsappText);
      else {
        const ta = document.createElement("textarea");
        ta.value = whatsappText;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("error");
      setTimeout(() => setCopyState("idle"), 2200);
    }
  };

  const toggleRowActionsMenu = (row, target) => {
    if (!target) return;
    setOpenRowMenu((prev) => {
      if (prev?.rowId === row.id) return null;
      const rect = target.getBoundingClientRect();
      const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 0;
      const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 0;

      return {
        rowId: row.id,
        rowData: row,
        anchorRect: {
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
        },
        viewport: {
          width: viewportWidth,
          height: viewportHeight,
        },
      };
    });
  };

  const handleRowMenuAction = (action) => {
    if (!openRowMenu?.rowData) return;
    if (action === "chat") {
      setChatModal({ row: openRowMenu.rowData });
    }
    setOpenRowMenu(null);
  };

  const rowMenuPosition = openRowMenu
    ? (() => {
        const width = 160;
        const gutter = 12;
        const viewportWidth =
          openRowMenu.viewport?.width ??
          (typeof window !== "undefined" ? window.innerWidth : 0);
        const viewportHeight =
          openRowMenu.viewport?.height ??
          (typeof window !== "undefined" ? window.innerHeight : 0);
        const safeViewportWidth = viewportWidth || width + gutter * 2;
        const safeViewportHeight =
          viewportHeight || openRowMenu.anchorRect.bottom + 8 + 60;
        const desiredLeft = openRowMenu.anchorRect.right - width;
        const left = Math.max(
          gutter,
          Math.min(safeViewportWidth - gutter - width, desiredLeft),
        );
        const desiredTop = openRowMenu.anchorRect.bottom + 8;
        const top = Math.max(
          gutter,
          Math.min(safeViewportHeight - gutter - 10, desiredTop),
        );
        return { left, top, width };
      })()
    : null;

  const openFormDetailModal = (formName, row) => {
    const entries = row.formDetails?.[formName] ?? [];
    const primaryEntry = entries[0] ?? null;
    let questionAnswers = null;
    let scoreSummary = null;
    let historicalEntries = [];

    if (formName === "IKDC" && primaryEntry) {
      questionAnswers = ikdcQuestions.map((question) => ({
        id: question.id,
        text: question.text,
        answer: formatAnswerValue(question, primaryEntry[question.id]),
        sectionMeta: null,
      }));
      scoreSummary = {
        type: "IKDC",
        ...computeIkdcScore(primaryEntry, ikdcQuestions),
      };
      historicalEntries = Array.isArray(primaryEntry.historical)
        ? primaryEntry.historical.filter((item) => (item?.type ?? "").toLowerCase() === "ikdc")
        : [];
    } else if (formName === "LYSHOLM-TEGNER" && primaryEntry) {
      questionAnswers = [
        ...lysholmQuestions.map((question) => ({
          id: question.id,
          text: question.title,
          answer: formatAnswerValue(question, primaryEntry[question.id]),
          sectionMeta: null,
        })),
        {
          id: tegnerQuestion.id,
          text: tegnerQuestion.title,
          answer: findTegnerLabel(primaryEntry[tegnerQuestion.id], tegnerQuestion) || "Sin respuesta",
          sectionMeta: null,
        },
      ];
      const lysholmScore = computeLysholmScore(primaryEntry, lysholmQuestions);
      scoreSummary = {
        type: "LYSHOLM",
        lysholmScore,
        interpretation: interpretLysholm(lysholmScore.score),
        tegnerValue: primaryEntry[tegnerQuestion.id],
        tegnerLabel: findTegnerLabel(primaryEntry[tegnerQuestion.id], tegnerQuestion),
      };
      historicalEntries = Array.isArray(primaryEntry.historical)
        ? primaryEntry.historical.filter((item) => (item?.type ?? "").toLowerCase() === "lysholm-tegner")
        : [];
    } else if (formName === "IKS" && primaryEntry) {
      const { questionAnswers: iksAnswers, iksScore } = buildIksDetails(primaryEntry);
      questionAnswers = iksAnswers;
      scoreSummary = {
        type: "IKS",
        iksScore,
      };
      historicalEntries = Array.isArray(primaryEntry.historical)
        ? primaryEntry.historical.filter((item) => (item?.type ?? "").toLowerCase() === "iks")
        : [];
    } else if (formName === "KOOS" && primaryEntry) {
      const { questionAnswers: koosAnswers, scores } = buildKoosDetails(primaryEntry);
      questionAnswers = koosAnswers;
      scoreSummary = {
        type: "KOOS",
        subscales: scores,
      };
      historicalEntries = Array.isArray(primaryEntry.historical)
        ? primaryEntry.historical.filter((item) => (item?.type ?? "").toLowerCase() === "koos")
        : [];
    } else if (formName === "WOMAC" && primaryEntry) {
      questionAnswers = WOMAC_QUESTIONS.map((question) => ({
        id: question.id,
        text: question.text,
        answer: formatAnswerValue(question, primaryEntry[question.id]),
        sectionMeta: SECTION_HEADINGS[question.section],
      }));
      const womacScore = computeWomacScores(primaryEntry, WOMAC_QUESTIONS);
      scoreSummary = {
        type: "WOMAC",
        womacScore,
        severity: severityLabel(womacScore.normalized.total),
      };
      historicalEntries = Array.isArray(primaryEntry.historical)
        ? primaryEntry.historical.filter((item) => (item?.type ?? "").toLowerCase() === "womac")
        : [];
    }

    setFormDetailModal({
      formName,
      patientName: row.nombre !== "—" ? row.nombre : row.email,
      email: row.email,
      entry: primaryEntry,
      formattedDate: formatTimestamp(primaryEntry?.date),
      questionAnswers,
      scoreSummary,
      historicalEntries,
    });
  };

  const closeChatModal = () => setChatModal(null);

  const chatPatientRow = chatModal?.row ?? null;
  const normalizeText = (value) => (typeof value === "string" ? value.trim() : "");
  const normalizedName = normalizeText(chatPatientRow?.nombre);
  const normalizedEmail = normalizeText(chatPatientRow?.email);
  const chatPatientName = chatPatientRow
    ? (normalizedName && normalizedName !== "—"
        ? normalizedName
        : normalizedEmail && normalizedEmail !== "—"
          ? normalizedEmail
          : "Chat IA")
    : null;
  const chatPatientEmail = normalizedEmail && normalizedEmail !== "—" ? normalizedEmail : null;

  const closeFormDetailModal = () => setFormDetailModal(null);

  const openHistoricalModal = ({ formName, entries, patientName, email }) => {
    if (!entries?.length) return;
    const prepared = entries.map((item, index) => {
      const answers = item.data ?? {};
      let questionAnswers = [];
      let scoreSummary = null;

      if (formName === "IKDC") {
        questionAnswers = ikdcQuestions.map((question) => ({
          id: question.id,
          text: question.text,
          answer: formatAnswerValue(question, answers[question.id]),
          sectionMeta: null,
        }));
        scoreSummary = {
          type: "IKDC",
          ...computeIkdcScore(answers, ikdcQuestions),
        };
      } else if (formName === "LYSHOLM-TEGNER") {
        questionAnswers = [
          ...lysholmQuestions.map((question) => ({
            id: question.id,
            text: question.title,
            answer: formatAnswerValue(question, answers[question.id]),
            sectionMeta: null,
          })),
          {
            id: tegnerQuestion.id,
            text: tegnerQuestion.title,
            answer: findTegnerLabel(answers[tegnerQuestion.id], tegnerQuestion) || "Sin respuesta",
            sectionMeta: null,
          },
        ];
        const lysholmScore = computeLysholmScore(answers, lysholmQuestions);
        scoreSummary = {
          type: "LYSHOLM",
          lysholmScore,
          interpretation: interpretLysholm(lysholmScore.score),
          tegnerValue: answers[tegnerQuestion.id],
          tegnerLabel: findTegnerLabel(answers[tegnerQuestion.id], tegnerQuestion),
        };
      } else if (formName === "IKS") {
        const { questionAnswers: iksAnswers, iksScore } = buildIksDetails(answers);
        questionAnswers = iksAnswers;
        scoreSummary = {
          type: "IKS",
          iksScore,
        };
      } else if (formName === "KOOS") {
        const { questionAnswers: koosAnswers, scores } = buildKoosDetails(answers);
        questionAnswers = koosAnswers;
        scoreSummary = {
          type: "KOOS",
          subscales: scores,
        };
      } else if (formName === "WOMAC") {
        questionAnswers = WOMAC_QUESTIONS.map((question) => ({
          id: question.id,
          text: question.text,
          answer: formatAnswerValue(question, answers[question.id]),
          sectionMeta: SECTION_HEADINGS[question.section],
        }));
        const womacScore = computeWomacScores(answers, WOMAC_QUESTIONS);
        scoreSummary = {
          type: "WOMAC",
          womacScore,
          severity: severityLabel(womacScore.normalized.total),
        };
      }

      return {
        id: item.id ?? `historical-${index}`,
        formattedDate: formatTimestamp(item.date),
        scoreSummary,
        questionAnswers,
      };
    });
    setHistoricalModal({
      formName,
      patientName,
      email,
      entries: prepared,
      selectedIndex: null,
    });
  };

  const closeHistoricalModal = () => setHistoricalModal(null);

  const toggleHistoricalDetail = (index) => {
    setHistoricalModal((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        selectedIndex: prev.selectedIndex === index ? null : index,
      };
    });
  };

  // Helpers de estilo para celdas/encabezados
  const thStyle = (key) => ({
    position: "sticky",
    top: 0,
    zIndex: 1,
    padding: "12px 14px",
    textAlign: CENTER_KEYS.has(key) ? "center" : "left",
    fontSize: 12,
    fontWeight: 800,
    color: palette.ink,                 // texto como el botón
    background: palette.accent,         // 💚 verde claro como el botón
    borderBottom: `1px solid ${palette.border}`,
    borderRight: `1px solid ${palette.border}`,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  });

  const tdStyle = (key) => ({
    padding: "10px 14px",
    color: palette.text,
    borderRight: `1px solid ${palette.border}`,
    whiteSpace: "nowrap",
    fontSize: 13,
    textAlign: CENTER_KEYS.has(key) ? "center" : "left",
    verticalAlign: "middle",
    overflow: "hidden",
    textOverflow: "ellipsis",
  });

  const dashStyle = { opacity: 0.65, color: palette.text, fontWeight: 700 };

  const renderHistoricalScoreSummary = (summary) => {
    if (!summary) return null;
    if (summary.type === "IKDC") {
      return summary.valid ? (
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: palette.accent }}>
            {summary.score}
            <span style={{ fontSize: 12, color: palette.text }}> / 100</span>
          </div>
          <div style={{ fontSize: 11, color: palette.textMuted }}>
            Respondidas: {summary.answered}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 11, color: palette.textMuted, textAlign: "right" }}>
          Puntaje inválido ({summary.answered} respondidas)
        </div>
      );
    }
    if (summary.type === "LYSHOLM") {
      return (
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: palette.accent }}>
            {summary.lysholmScore.score}
            <span style={{ fontSize: 12, color: palette.text }}> / 100</span>
          </div>
          <div style={{ fontSize: 11, color: summary.interpretation?.color ?? palette.text }}>
            {summary.interpretation?.label ?? "—"}
          </div>
          {summary.tegnerLabel && (
            <div style={{ fontSize: 11, color: palette.textMuted }}>
              Tegner: {summary.tegnerLabel}
              {Number.isFinite(summary.tegnerValue) && ` (Nivel ${summary.tegnerValue})`}
            </div>
          )}
        </div>
      );
    }
    if (summary.type === "IKS") {
      const iksScore = summary.iksScore ?? {};
      return (
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, color: palette.textMuted }}>Knee</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: palette.accent }}>
            {iksScore.kneeScore ?? "—"}
            <span style={{ fontSize: 11, color: palette.text }}> / 100</span>
          </div>
          <div style={{ fontSize: 12, color: palette.textMuted, marginTop: 4 }}>Función</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: palette.accent }}>
            {iksScore.functionScore ?? "—"}
            <span style={{ fontSize: 11, color: palette.text }}> / 100</span>
          </div>
        </div>
      );
    }
    if (summary.type === "WOMAC") {
      return (
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: palette.accent }}>
            {summary.womacScore.normalized.total}%
          </div>
          <div style={{ fontSize: 11, color: summary.severity?.color ?? palette.text }}>
            {summary.severity?.label ?? "—"}
          </div>
        </div>
      );
    }
    if (summary.type === "KOOS") {
      const subscales = summary.subscales ?? {};
      return (
        <div style={{ fontSize: 11, color: palette.text, textAlign: "right", display: "grid", gap: 2 }}>
          {Object.values(KOOS_SECTIONS).map((section) => {
            const data = subscales[section.key];
            const label = `${section.title.split(" — ")[0] ?? section.title}: `;
            const value = data?.valid ? `${data.score} / 100` : "Datos insuficientes";
            return (
              <span key={section.key} style={{ color: data?.valid ? palette.text : palette.textMuted }}>
                {label}{value}
              </span>
            );
          })}
        </div>
      );
    }
    return null;
  };

  const renderQuestionAnswerList = (list) => {
    if (!list?.length) return null;
    return list.map((qa, idx) => {
      const prev = list[idx - 1];
      const showSection = qa.sectionMeta && qa.sectionMeta !== prev?.sectionMeta;
      return (
        <div key={`${qa.id}-${idx}`} style={{ display: "grid", gap: 6 }}>
          {showSection && (
            <div
              style={{
                border: `1px dashed ${palette.border}`,
                borderRadius: 10,
                padding: "8px 10px",
                background: "rgba(3,23,24,0.35)",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, color: palette.text }}>{qa.sectionMeta.title}</div>
              <div style={{ fontSize: 11, color: palette.textMuted }}>{qa.sectionMeta.instruction}</div>
            </div>
          )}
          <div
            style={{
              border: `1px solid ${palette.border}`,
              background: "rgba(3,23,24,0.55)",
              borderRadius: 10,
              padding: "10px 12px",
              display: "grid",
              gap: 4,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: palette.text }}>{qa.text}</div>
            <div style={{ fontSize: 13, color: palette.textMuted }}>{qa.answer}</div>
          </div>
        </div>
      );
    });
  };

  return (
    <main
      style={{
        padding: "24px 32px",
        display: "grid",
        gap: 18,
        alignContent: "start",
        justifyItems: "start",
        textAlign: "left",
      }}
    >
      {/* Header */}
      <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h1 style={{ fontSize: 24, margin: 0, fontWeight: 800, color: palette.text, textAlign: "left" }}>
          Formularios
        </h1>

        <button
          type="button"
          onClick={() => {
            setCopyState("idle");
            setOpen(true);
          }}
          style={{
            padding: "10px 16px",
            border: "none",
            borderRadius: 10,
            fontWeight: 800,
            background: palette.accent,
            color: palette.ink,
            boxShadow: "0 0 30px 6px rgba(210, 242, 82, 0.25)",
            cursor: "pointer",
          }}
        >
          Enviar
        </button>
      </div>

      {/* TABLA */}
      <div
        style={{
          width: "100%",
          border: `1px solid ${palette.border}`,
          borderRadius: 12,
          overflow: "hidden",
          background: "rgba(3,23,24,0.30)",
          boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ maxHeight: 380, overflow: "auto" }}>
          <table
            style={{
              width: "100%",
              minWidth: "1200px",
              borderCollapse: "collapse",
              tableLayout: "fixed",
            }}
          >
            <colgroup>
              {COL_WIDTHS.map((w, i) => (
                <col key={i} style={{ width: `${w}px` }} />
              ))}
            </colgroup>

            <thead>
              <tr>
                {TABLE_COLUMNS.map((c) => (
                  <th key={c.key} style={thStyle(c.key)}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={TABLE_COLUMNS.length}
                    style={{ padding: 16, color: palette.text, opacity: 0.8, fontStyle: "italic", textAlign: "center" }}
                  >
                    Cargando registros...
                  </td>
                </tr>
              )}

              {!loading && error && (
                <tr>
                  <td
                    colSpan={TABLE_COLUMNS.length}
                    style={{ padding: 16, color: palette.danger, fontWeight: 700, textAlign: "center" }}
                  >
                    {error}
                  </td>
                </tr>
              )}

              {!loading && !error && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={TABLE_COLUMNS.length}
                    style={{ padding: 16, color: palette.text, opacity: 0.8, fontStyle: "italic", textAlign: "center" }}
                  >
                    Aún no hay registros.
                  </td>
                </tr>
              )}

              {!loading &&
                !error &&
                rows.map((r, idx) => (
                  <tr
                    key={r.id}
                    style={{
                      background: idx % 2 === 0 ? "rgba(3,23,24,0.20)" : "rgba(3,23,24,0.30)",
                      borderBottom: `1px solid ${palette.border}`,
                  }}
                >
                  {/* Email (izquierda) */}
                  <td style={tdStyle("email")}>
                    <div style={TRUNCATE_STYLE}>
                      <strong>{r.email}</strong>
                    </div>
                  </td>

                  {/* Nombre (izquierda) */}
                  <td style={tdStyle("nombre")}>
                    <div style={TRUNCATE_STYLE}>{r.nombre}</div>
                  </td>

                  {/* Sexo (centro) */}
                  <td style={tdStyle("sexo")}>
                    <div style={TRUNCATE_STYLE}>{formatSexForDisplay(r.sexo)}</div>
                  </td>

                  {/* Fecha de nacimiento (centro) */}
                  <td style={tdStyle("fechaNacimiento")}>
                    <div style={TRUNCATE_STYLE}>{r.fechaNacimiento}</div>
                  </td>

                  {/* ¿Operado? (solo icono, centrado) */}
                  <td style={tdStyle("operado")}>
                    <div style={{ display: "grid", placeItems: "center" }}>
                      {r.operado ? (
                        <CheckIcon color={palette.accent} />
                      ) : (
                        <XIcon color={palette.text} />
                      )}
                    </div>
                  </td>

                  {/* Formularios: "-" si no hay registro; “ojo” si hay (centrados) */}
                  {OPTIONS.map((formName) => {
                    const hasRecord = !!r.records?.[formName];
                    const hasDetailView = DETAIL_FORMS.has(formName);
                    return (
                      <td key={`${r.id}-${formName}`} style={tdStyle(formName)}>
                        <div style={{ display: "grid", placeItems: "center" }}>
                          {hasRecord ? (
                            hasDetailView ? (
                              <button
                                type="button"
                                onClick={() => openFormDetailModal(formName, r)}
                                title={`Ver detalles de ${formName}`}
                                aria-label={`Ver detalles de ${formName}`}
                                style={{
                                  border: "none",
                                  background: "transparent",
                                  padding: 0,
                                  cursor: "pointer",
                                  display: "grid",
                                  placeItems: "center",
                                }}
                              >
                                <EyeIcon color={palette.accent} />
                              </button>
                            ) : (
                              <EyeIcon color={palette.accent} />
                            )
                          ) : (
                            <span style={dashStyle}>-</span>
                          )}
                        </div>
                      </td>
                    );
                  })}

                  {/* Columna de detalles */}
                  <td style={tdStyle("detalles")}>
                    <div style={{ display: "grid", placeItems: "center" }}>
                      <button
                        type="button"
                        data-row-menu-trigger="true"
                        onClick={(event) => toggleRowActionsMenu(r, event.currentTarget)}
                        title="Ver detalles"
                        aria-label="Ver detalles"
                        style={{
                          border: "none",
                          background: "transparent",
                          padding: 0,
                          cursor: "pointer",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <DotsIcon color={palette.accent} />
                      </button>
                    </div>
                  </td>
                </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {rowMenuPosition && (
        <div
          data-row-menu-panel="true"
          style={{
            position: "fixed",
            top: rowMenuPosition.top,
            left: rowMenuPosition.left,
            width: rowMenuPosition.width,
            padding: 6,
            borderRadius: 10,
            border: `1px solid ${palette.border}`,
            background: "rgba(3,23,24,0.95)",
            boxShadow: "0 24px 50px rgba(0,0,0,0.45)",
            zIndex: 50,
          }}
        >
          <button
            type="button"
            onClick={() => handleRowMenuAction("chat")}
            style={{
              width: "100%",
              border: "none",
              background: "transparent",
              color: palette.text,
              textAlign: "left",
              fontSize: 13,
              fontWeight: 600,
              padding: "8px 10px",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            Chat
          </button>
        </div>
      )}

      {/* Dialog */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(2px)",
            display: "grid",
            placeItems: "center",
            zIndex: 9999,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "50vw",
              border: `1px solid ${palette.border}`,
              background: palette.surface,
              borderRadius: 14,
              boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
              overflow: "hidden",
              boxSizing: "border-box",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "14px 16px",
                borderBottom: `1px solid ${palette.border}`,
                background: "linear-gradient(180deg, rgba(3,23,24,0.7), rgba(3,23,24,0.4))",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: palette.text }}>
                Elige formulario(s)
              </h3>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                style={{
                  width: 36,
                  height: 36,
                  display: "grid",
                  placeItems: "center",
                  border: `1px solid ${palette.border}`,
                  borderRadius: 10,
                  background: "rgba(3,23,24,0.55)",
                  color: palette.text,
                  cursor: "pointer",
                  padding: 0,
                  transition: "transform .06s, background .15s, color .15s, box-shadow .15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = palette.accent;
                  e.currentTarget.style.color = palette.ink;
                  e.currentTarget.style.boxShadow = "0 0 20px 4px rgba(210, 242, 82, 0.25)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(3,23,24,0.55)";
                  e.currentTarget.style.color = palette.text;
                  e.currentTarget.style.boxShadow = "none";
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
                onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                ✕
              </button>
            </div>

            {/* Opciones (pills) */}
            <div style={{ padding: 16, display: "flex", gap: 12, width: "100%", boxSizing: "border-box", overflowX: "hidden" }}>
              {OPTIONS.map((name) => {
                const isActive = selected.has(name);
                return (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => toggleOption(name)}
                    style={{
                      flex: "0 0 calc((100% - 4 * 12px) / 5)",
                      minWidth: 0,
                      height: 46,
                      padding: "0 14px",
                      borderRadius: 12,
                      fontWeight: 800,
                      textAlign: "center",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      cursor: "pointer",
                      transition: "transform .06s",
                      ...(isActive
                        ? {
                            background: palette.accent,
                            color: palette.ink,
                            border: "none",
                            boxShadow: "0 0 30px 6px rgba(210, 242, 82, 0.25), inset 0 -2px 0 rgba(0,0,0,0.08)",
                          }
                        : {
                            background: "rgba(3,23,24,0.45)",
                            color: palette.text,
                            border: `1px solid ${palette.accent}`,
                          }),
                    }}
                    onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
                    onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                  >
                    {name}
                  </button>
                );
              })}
            </div>

            {/* Preview WhatsApp */}
            <div style={{ padding: "0 16px 8px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: palette.text, opacity: 0.85, marginBottom: 6 }}>
                Texto para WhatsApp
              </div>
              <div
                style={{
                  border: `1px solid ${palette.border}`,
                  background: "rgba(3,23,24,0.35)",
                  color: palette.text,
                  borderRadius: 10,
                  padding: 12,
                  maxHeight: 140,
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  fontSize: 13,
                  lineHeight: 1.35,
                }}
              >
                {whatsappText}
              </div>
            </div>

            {/* Footer: copiar */}
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, padding: "12px 16px 16px", borderTop: `1px solid ${palette.border}` }}>
              {copyState === "copied" && (
                <span style={{ fontSize: 12, fontWeight: 700, color: palette.accent, marginRight: "auto" }}>
                  ¡Copiado!
                </span>
              )}
              {copyState === "error" && (
                <span style={{ fontSize: 12, fontWeight: 700, color: "#ff6b6b", marginRight: "auto" }}>
                  Ocurrió un error al copiar.
                </span>
              )}

              <button
                type="button"
                onClick={copyToClipboard}
                style={{
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: "none",
                  background: palette.accent,
                  color: palette.ink,
                  fontWeight: 800,
                  cursor: "pointer",
                  boxShadow: "0 0 30px 6px rgba(210, 242, 82, 0.25)",
                }}
              >
                Copiar
              </button>
            </div>
          </div>
        </div>
      )}

      {chatModal && (
        <div
          onClick={closeChatModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "grid",
            placeItems: "center",
            padding: "24px 16px",
            zIndex: 10500,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Chat con paciente"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(1180px, 92vw)",
              maxHeight: "92vh",
              borderRadius: 22,
              border: `1px solid ${palette.border}`,
              overflow: "hidden",
              boxShadow: "0 30px 120px rgba(0,0,0,0.55)",
              background: "rgba(3,23,24,0.9)",
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 18px",
                borderBottom: `1px solid ${palette.border}`,
                background: "linear-gradient(180deg, rgba(3,23,24,0.65), rgba(3,23,24,0.35))",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: palette.textMuted }}>
                  Conversación
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: palette.text }}>
                  {chatPatientName || "Chat IA"}
                </div>
                {chatPatientEmail && (
                  <div style={{ fontSize: 13, color: palette.textMuted }}>{chatPatientEmail}</div>
                )}
              </div>
              <button
                type="button"
                onClick={closeChatModal}
                aria-label="Cerrar chat"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  border: `1px solid ${palette.border}`,
                  background: "rgba(3,23,24,0.65)",
                  color: palette.text,
                  cursor: "pointer",
                  fontSize: 18,
                  fontWeight: 700,
                  padding: 0,
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
              <ChatMain palette={palette} />
            </div>
          </div>
        </div>
      )}

      {formDetailModal && (
        <div
          onClick={closeFormDetailModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(2px)",
            display: "grid",
            placeItems: "center",
            zIndex: 10000,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "520px",
              maxWidth: "90vw",
              border: `1px solid ${palette.border}`,
              background: palette.surface,
              borderRadius: 14,
              boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
              overflow: "hidden",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "14px 16px",
                borderBottom: `1px solid ${palette.border}`,
                background: "linear-gradient(180deg, rgba(3,23,24,0.7), rgba(3,23,24,0.4))",
              }}
            >
              <div style={{ display: "grid", gap: 2 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: palette.text }}>
                  {formDetailModal.formName} · {formDetailModal.patientName}
                </h3>
                <div style={{ fontSize: 12, color: palette.textMuted }}>{formDetailModal.email}</div>
                <div style={{ fontSize: 12, color: palette.textMuted }}>
                  {formDetailModal.formattedDate ?? "—"}
                </div>
              </div>

              <button
                type="button"
                onClick={closeFormDetailModal}
                aria-label="Cerrar"
                style={{
                  width: 36,
                  height: 36,
                  display: "grid",
                  placeItems: "center",
                  border: `1px solid ${palette.border}`,
                  borderRadius: 10,
                  background: "rgba(3,23,24,0.55)",
                  color: palette.text,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: 16, display: "grid", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: palette.text, opacity: 0.85 }}>Registro</div>
                {formDetailModal.historicalEntries?.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      openHistoricalModal({
                        formName: formDetailModal.formName,
                        entries: formDetailModal.historicalEntries,
                        patientName: formDetailModal.patientName,
                        email: formDetailModal.email,
                      })
                    }
                    style={{
                      border: "none",
                      borderRadius: 8,
                      padding: "6px 12px",
                      fontSize: 12,
                      fontWeight: 700,
                      background: palette.accent,
                      color: palette.ink,
                      cursor: "pointer",
                      boxShadow: "0 0 18px 4px rgba(210, 242, 82, 0.25)",
                    }}
                  >
                    Históricos
                  </button>
                )}
              </div>

              {formDetailModal.formName === "IKDC" && formDetailModal.scoreSummary && (
                <div
                  style={{
                    border: `1px solid ${palette.border}`,
                    background: "rgba(3,23,24,0.55)",
                    borderRadius: 10,
                    padding: "12px 14px",
                    display: "grid",
                    gap: 4,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: palette.text }}>Puntuación IKDC</div>
                  {formDetailModal.scoreSummary.valid ? (
                    <>
                      <div style={{ fontSize: 28, fontWeight: 800, color: palette.accent }}>
                        {formDetailModal.scoreSummary.score}
                        <span style={{ fontSize: 14, color: palette.text }}> / 100</span>
                      </div>
                      <div style={{ fontSize: 12, color: palette.textMuted }}>
                        Preguntas respondidas: {formDetailModal.scoreSummary.answered} de {IKDC_SCORABLE_COUNT}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 12, color: palette.textMuted }}>
                      Se requieren al menos 16 respuestas puntuables (actualmente {formDetailModal.scoreSummary.answered}).
                    </div>
                  )}
                </div>
              )}

              {formDetailModal.formName === "IKS" && formDetailModal.scoreSummary && (
                <div
                  style={{
                    border: `1px solid ${palette.border}`,
                    background: "rgba(3,23,24,0.55)",
                    borderRadius: 10,
                    padding: "12px 14px",
                    display: "grid",
                    gap: 8,
                  }}
                >
                  {(() => {
                    const iksScore = formDetailModal.scoreSummary.iksScore ?? {};
                    return (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 700, color: palette.text }}>IKS Knee Score</div>
                        <div style={{ fontSize: 32, fontWeight: 800, color: palette.accent }}>
                          {iksScore.kneeScore ?? "—"}
                          <span style={{ fontSize: 14, color: palette.text }}> / 100</span>
                        </div>
                        <div style={{ fontSize: 12, color: palette.textMuted }}>
                          Componentes positivos (dolor + movilidad + estabilidad): {iksScore.kneePositive ?? "—"} pts
                        </div>
                        <div style={{ fontSize: 12, color: palette.textMuted }}>
                          Deducciones totales: {iksScore.kneeDeductions ?? "—"} pts
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                            gap: 8,
                            marginTop: 4,
                          }}
                        >
                          <div
                            style={{
                              border: `1px solid ${palette.border}`,
                              borderRadius: 8,
                              padding: "8px 10px",
                              fontSize: 12,
                              color: palette.text,
                            }}
                          >
                            <div style={{ fontWeight: 700 }}>Movilidad</div>
                            <div>{iksScore.mobilityPts ?? "—"} pts</div>
                          </div>
                          <div
                            style={{
                              border: `1px solid ${palette.border}`,
                              borderRadius: 8,
                              padding: "8px 10px",
                              fontSize: 12,
                              color: palette.text,
                            }}
                          >
                            <div style={{ fontWeight: 700 }}>Estabilidad</div>
                            <div>{iksScore.stabilityPts ?? "—"} pts</div>
                          </div>
                        </div>
                        <div
                          style={{
                            marginTop: 12,
                            paddingTop: 8,
                            borderTop: `1px dashed ${palette.border}`,
                            display: "grid",
                            gap: 4,
                          }}
                        >
                          <div style={{ fontSize: 12, fontWeight: 700, color: palette.text }}>IKS Function Score</div>
                          <div style={{ fontSize: 28, fontWeight: 800, color: palette.accent }}>
                            {iksScore.functionScore ?? "—"}
                            <span style={{ fontSize: 14, color: palette.text }}> / 100</span>
                          </div>
                          <div style={{ fontSize: 12, color: palette.textMuted }}>
                            Marcha + escaleras + uso de ayudas
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {formDetailModal.formName === "KOOS" && formDetailModal.scoreSummary && (
                <div
                  style={{
                    border: `1px solid ${palette.border}`,
                    background: "rgba(3,23,24,0.55)",
                    borderRadius: 10,
                    padding: "12px 14px",
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: palette.text }}>Subescalas KOOS (0 = peor, 100 = mejor)</div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: 10,
                    }}
                  >
                    {Object.values(KOOS_SECTIONS).map((section) => {
                      const data = formDetailModal.scoreSummary.subscales?.[section.key];
                      const valid = data?.valid;
                      return (
                        <div
                          key={section.key}
                          style={{
                            border: `1px solid ${palette.border}`,
                            borderRadius: 10,
                            padding: "10px",
                            display: "grid",
                            gap: 4,
                            background: "rgba(3,23,24,0.35)",
                          }}
                        >
                          <div style={{ fontSize: 12, fontWeight: 700, color: palette.text }}>{section.title}</div>
                          <div style={{ fontSize: 22, fontWeight: 800, color: palette.accent }}>
                            {valid ? (
                              <>
                                {data.score}
                                <span style={{ fontSize: 12, color: palette.text }}> / 100</span>
                              </>
                            ) : (
                              <span style={{ fontSize: 12, color: palette.textMuted }}>Datos insuficientes</span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: palette.textMuted }}>
                            Respondidas: {data?.answered ?? 0} / {section.maxItems}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {formDetailModal.formName === "LYSHOLM-TEGNER" && formDetailModal.scoreSummary && (
                <div
                  style={{
                    border: `1px solid ${palette.border}`,
                    background: "rgba(3,23,24,0.55)",
                    borderRadius: 10,
                    padding: "12px 14px",
                    display: "grid",
                    gap: 4,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: palette.text }}>Puntuación Lysholm</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <div style={{ fontSize: 32, fontWeight: 800, color: palette.accent }}>
                      {formDetailModal.scoreSummary.lysholmScore.score}
                    </div>
                    <div style={{ fontSize: 14, color: palette.text }}>/ 100</div>
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: formDetailModal.scoreSummary.interpretation.color,
                    }}
                  >
                    {formDetailModal.scoreSummary.interpretation.label}
                  </div>
                  <div style={{ fontSize: 12, color: palette.textMuted }}>
                    Preguntas respondidas: {formDetailModal.scoreSummary.lysholmScore.answeredCount} de{" "}
                    {lysholmQuestions.length}
                  </div>
                  {formDetailModal.scoreSummary.tegnerLabel && (
                    <div
                      style={{
                        marginTop: 6,
                        padding: "8px 10px",
                        borderRadius: 8,
                        background: "rgba(255,255,255,0.07)",
                        fontSize: 12,
                        color: palette.text,
                      }}
                    >
                      Tegner: {formDetailModal.scoreSummary.tegnerLabel}
                      {Number.isFinite(formDetailModal.scoreSummary.tegnerValue) &&
                        ` (Nivel ${formDetailModal.scoreSummary.tegnerValue})`}
                    </div>
                  )}
                </div>
              )}

              {formDetailModal.formName === "WOMAC" && formDetailModal.scoreSummary && (
                <div
                  style={{
                    border: `1px solid ${palette.border}`,
                    background: "rgba(3,23,24,0.55)",
                    borderRadius: 10,
                    padding: "12px 14px",
                    display: "grid",
                    gap: 6,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: palette.text }}>Puntuación WOMAC</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                    <div style={{ fontSize: 36, fontWeight: 800, color: palette.accent }}>
                      {formDetailModal.scoreSummary.womacScore.normalized.total}%
                    </div>
                    <div style={{ fontSize: 14, color: palette.text }}>Severidad total</div>
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: formDetailModal.scoreSummary.severity.color,
                    }}
                  >
                    {formDetailModal.scoreSummary.severity.label}
                  </div>
                  <div style={{ fontSize: 12, color: palette.textMuted }}>
                    Respuestas: {formDetailModal.scoreSummary.womacScore.answered} de{" "}
                    {formDetailModal.scoreSummary.womacScore.maxAnswered}
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                      gap: 8,
                      marginTop: 8,
                    }}
                  >
                    {["pain", "stiffness", "function"].map((section) => (
                      <div
                        key={section}
                        style={{
                          border: `1px solid ${palette.border}`,
                          borderRadius: 8,
                          padding: "8px 10px",
                          fontSize: 12,
                          color: palette.text,
                        }}
                      >
                        <div style={{ fontWeight: 700, textTransform: "capitalize" }}>{section}</div>
                        <div>{formDetailModal.scoreSummary.womacScore.normalized[section]}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {formDetailModal.questionAnswers && (
                <div style={{ display: "grid", gap: 8, maxHeight: 240, overflow: "auto", paddingRight: 4 }}>
                  {renderQuestionAnswerList(formDetailModal.questionAnswers)}
                </div>
              )}

              {!formDetailModal.entry && (
                <div
                  style={{
                    border: `1px solid ${palette.border}`,
                    background: "rgba(3,23,24,0.25)",
                    color: palette.text,
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 13,
                  }}
                >
                  Sin información disponible para este formulario.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {historicalModal && (
        <div
          onClick={closeHistoricalModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(2px)",
            display: "grid",
            placeItems: "center",
            zIndex: 10001,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "60vw",
              maxWidth: 860,
              border: `1px solid ${palette.border}`,
              background: palette.surface,
              borderRadius: 16,
              boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
              overflow: "hidden",
              maxHeight: "80vh",
              display: "grid",
              gridTemplateRows: "auto 1fr",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "16px 20px",
                borderBottom: `1px solid ${palette.border}`,
                background: "linear-gradient(180deg, rgba(3,23,24,0.7), rgba(3,23,24,0.4))",
              }}
            >
              <div style={{ display: "grid", gap: 2 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: palette.text }}>
                  Históricos {historicalModal.formName} · {historicalModal.patientName}
                </h3>
                <div style={{ fontSize: 12, color: palette.textMuted }}>{historicalModal.email}</div>
              </div>

              <button
                type="button"
                onClick={closeHistoricalModal}
                aria-label="Cerrar"
                style={{
                  width: 40,
                  height: 40,
                  display: "grid",
                  placeItems: "center",
                  border: `1px solid ${palette.border}`,
                  borderRadius: 12,
                  background: "rgba(3,23,24,0.55)",
                  color: palette.text,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: 20, overflow: "auto" }}>
              {historicalModal.entries.length === 0 ? (
                <div
                  style={{
                    border: `1px solid ${palette.border}`,
                    borderRadius: 12,
                    padding: 16,
                    textAlign: "center",
                    color: palette.text,
                    background: "rgba(3,23,24,0.35)",
                  }}
                >
                  Aún no hay registros históricos para este formulario.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 14 }}>
                  {historicalModal.entries.map((entry, idx) => {
                    const isExpanded = historicalModal.selectedIndex === idx;
                    return (
                      <div
                        key={entry.id}
                        style={{
                          border: `1px solid ${palette.border}`,
                          borderRadius: 14,
                          background: "rgba(3,23,24,0.55)",
                          padding: 16,
                          display: "grid",
                          gap: 10,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                          <div>
                            <div style={{ fontSize: 12, color: palette.textMuted }}>Registro #{idx + 1}</div>
                            <div style={{ fontSize: 13, color: palette.text }}>{entry.formattedDate ?? "—"}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            {renderHistoricalScoreSummary(entry.scoreSummary)}
                            <button
                              type="button"
                              onClick={() => toggleHistoricalDetail(idx)}
                              style={{
                                border: `1px solid ${palette.border}`,
                                borderRadius: 8,
                                padding: "6px 12px",
                                fontSize: 12,
                                fontWeight: 700,
                                background: isExpanded ? palette.accent : "transparent",
                                color: isExpanded ? palette.ink : palette.text,
                                cursor: "pointer",
                              }}
                            >
                              {isExpanded ? "Ocultar" : "Ver detalles"}
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div style={{ display: "grid", gap: 8, maxHeight: 260, overflow: "auto", paddingRight: 4 }}>
                            {renderQuestionAnswerList(entry.questionAnswers)}
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
      )}
    </main>
  );
}
