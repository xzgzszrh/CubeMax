import { generateWebApiBase } from "@buildingai/services";
import { CheckCircle2, Clock3, Radio, RefreshCw, Timer, Trophy } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";

// ---------------------------------------------------------------------------
// 公开课堂大屏页面（/classroom-display/:publicId），无需登录。
// 数据来自公开接口 GET /api/classroom-display/:publicId，轮询刷新。
// 不走 apiHttpClient：公开页面不需要登录态，也避免轮询失败时反复弹 toast。
// ---------------------------------------------------------------------------

type DisplayTarget = { agentId: string; agentName: string };

type DisplayEvent = {
  id: string;
  agentId: string | null;
  agentName: string;
  taskKey: string;
  summary: string;
  score: number | null;
  occurredAt: string;
};

type DisplayConfig = {
  title: string;
  subtitle: string;
  layout: "grid" | "leaderboard" | "timeline";
  accentColor: string;
  columns: number;
  showTimer: boolean;
  showScore: boolean;
  showRecent: boolean;
  completionText: string;
  sortBy: "completed_at" | "score";
};

type DisplayData = {
  interaction: {
    name: string;
    status: "draft" | "active" | "ended";
    startedAt: string | null;
    endedAt: string | null;
    displayConfig: DisplayConfig;
    targets: DisplayTarget[];
  };
  events: DisplayEvent[];
};

async function fetchDisplay(publicId: string): Promise<DisplayData> {
  const response = await fetch(`${generateWebApiBase()}/classroom-display/${publicId}`, {
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as {
    code?: number;
    message?: string;
    data?: DisplayData;
  } | null;
  const ok =
    response.ok &&
    typeof payload?.code === "number" &&
    payload.code >= 20000 &&
    payload.code < 30000 &&
    payload.data;
  if (!ok) throw new Error(payload?.message || "课堂大屏加载失败");
  return payload.data as DisplayData;
}

function elapsedTime(startedAt: string, endedAt?: string | null) {
  const start = Date.parse(startedAt);
  const end = endedAt ? Date.parse(endedAt) : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "00:00";
  const seconds = Math.max(0, Math.floor((end - start) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours ? `${pad(hours)}:${pad(minutes)}:${pad(rest)}` : `${pad(minutes)}:${pad(rest)}`;
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

type DisplayEntry = { target: DisplayTarget; event: DisplayEvent | null };

export default function ClassroomDisplayPage() {
  const { publicId = "" } = useParams<{ publicId: string }>();
  const [data, setData] = useState<DisplayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      setData(await fetchDisplay(publicId));
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "课堂大屏加载失败");
    } finally {
      setLoading(false);
    }
  }, [publicId]);

  useEffect(() => {
    void load();
    const refreshTimer = window.setInterval(() => void load(), 2000);
    const clockTimer = window.setInterval(() => setTick((current) => current + 1), 1000);
    return () => {
      window.clearInterval(refreshTimer);
      window.clearInterval(clockTimer);
    };
  }, [load]);
  void tick;

  const entries = useMemo<DisplayEntry[]>(() => {
    if (!data) return [];
    // events 按时间倒序返回；反转后取每个智能体的第一次完成
    const firstCompletion = new Map<string, DisplayEvent>();
    for (const event of [...data.events].reverse()) {
      if (event.agentId && !firstCompletion.has(event.agentId)) {
        firstCompletion.set(event.agentId, event);
      }
    }
    const items = data.interaction.targets.map((target) => ({
      target,
      event: firstCompletion.get(target.agentId) || null,
    }));
    if (data.interaction.displayConfig.layout === "leaderboard") {
      items.sort((left, right) => {
        if (!left.event && !right.event) return 0;
        if (!left.event) return 1;
        if (!right.event) return -1;
        return data.interaction.displayConfig.sortBy === "score"
          ? (right.event.score ?? -1) - (left.event.score ?? -1)
          : Date.parse(left.event.occurredAt) - Date.parse(right.event.occurredAt);
      });
    }
    return items;
  }, [data]);

  if (loading) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-slate-950 text-slate-200">
        <RefreshCw className="size-7 animate-spin" />
        <span>正在加载课堂大屏</span>
      </main>
    );
  }
  if (error || !data) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-slate-950 text-slate-200">
        <Clock3 className="size-7" />
        <strong>{error || "课堂大屏不存在"}</strong>
      </main>
    );
  }

  const { interaction } = data;
  const config = interaction.displayConfig;
  const started = interaction.status !== "draft" && interaction.startedAt;
  const live = interaction.status === "active";
  const completed = entries.filter((entry) => entry.event).length;
  const latestEventId = data.events[0]?.id;
  const accentStyle = { "--display-accent": config.accentColor } as CSSProperties;

  return (
    <main
      className="flex min-h-dvh flex-col gap-6 bg-slate-950 p-6 text-slate-100 lg:p-10"
      style={accentStyle}
    >
      <header className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2.5">
          <span
            className="flex size-10 items-center justify-center rounded-xl text-white"
            style={{ backgroundColor: "var(--display-accent)" }}
          >
            <Radio className="size-5" />
          </span>
          <div className="leading-tight">
            <strong className="block">方糖猫课堂</strong>
            <span className="text-xs text-slate-400">
              {live ? "实时互动" : started ? "活动已结束" : "等待开始"}
            </span>
          </div>
        </div>
        <div className="min-w-0 flex-1 text-center">
          <h1 className="truncate text-2xl font-bold lg:text-4xl">{config.title}</h1>
          {config.subtitle ? (
            <p className="mt-1 truncate text-sm text-slate-400 lg:text-base">{config.subtitle}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-4">
          {config.showTimer && started && interaction.startedAt ? (
            <span className="flex items-center gap-1.5">
              <Timer className="size-5" />
              <strong className="font-mono text-xl">
                {elapsedTime(interaction.startedAt, interaction.endedAt)}
              </strong>
            </span>
          ) : null}
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="size-5" style={{ color: "var(--display-accent)" }} />
            <strong className="font-mono text-xl">
              {completed} / {entries.length}
            </strong>
          </span>
          {live ? (
            <span className="relative flex size-3">
              <span
                className="absolute inline-flex size-full animate-ping rounded-full opacity-60"
                style={{ backgroundColor: "var(--display-accent)" }}
              />
              <span
                className="relative inline-flex size-3 rounded-full"
                style={{ backgroundColor: "var(--display-accent)" }}
              />
            </span>
          ) : null}
        </div>
      </header>

      {!started ? (
        <section className="flex flex-1 flex-col items-center justify-center gap-4 text-slate-400">
          <Radio className="size-9" />
          <h2 className="text-xl font-medium">等待老师开始活动</h2>
        </section>
      ) : null}

      {started && config.layout === "grid" ? (
        <section
          className="grid flex-1 content-start gap-3"
          style={{ gridTemplateColumns: `repeat(${config.columns}, minmax(0, 1fr))` }}
        >
          {entries.map(({ target, event }) => {
            const recent = config.showRecent && event && event.id === latestEventId;
            return (
              <article
                className={
                  event
                    ? "flex items-center gap-3 rounded-xl border p-4"
                    : "flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4"
                }
                style={
                  event
                    ? {
                        borderColor: "var(--display-accent)",
                        backgroundColor: "color-mix(in srgb, var(--display-accent) 18%, transparent)",
                        boxShadow: recent ? "0 0 0 2px var(--display-accent)" : undefined,
                      }
                    : undefined
                }
                key={target.agentId}
              >
                {event ? (
                  <CheckCircle2
                    className="size-7 shrink-0"
                    style={{ color: "var(--display-accent)" }}
                  />
                ) : (
                  <Clock3 className="size-6 shrink-0 text-slate-500" />
                )}
                <div className="min-w-0 flex-1">
                  <strong className="block truncate">
                    {event
                      ? config.completionText.replaceAll("{agent}", target.agentName)
                      : target.agentName}
                  </strong>
                  <small className="block truncate text-slate-400">
                    {event ? event.summary : "进行中"}
                  </small>
                </div>
                {config.showScore && event?.score != null ? (
                  <em className="font-mono text-lg not-italic">{event.score}</em>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : null}

      {started && config.layout === "leaderboard" ? (
        <section className="flex flex-1 flex-col gap-1.5">
          <div className="grid grid-cols-[3rem_1fr_7rem_5rem] gap-2 px-4 pb-1 text-xs text-slate-500">
            <span>排名</span>
            <span>智能体</span>
            <span>完成时间</span>
            {config.showScore ? <span>得分</span> : <span />}
          </div>
          {entries.map(({ target, event }, index) => (
            <article
              className="grid grid-cols-[3rem_1fr_7rem_5rem] items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-2.5"
              style={
                event
                  ? {
                      borderColor: "color-mix(in srgb, var(--display-accent) 55%, transparent)",
                      backgroundColor: "color-mix(in srgb, var(--display-accent) 12%, transparent)",
                    }
                  : undefined
              }
              key={target.agentId}
            >
              <span className="font-mono text-xl font-bold">{event ? index + 1 : "-"}</span>
              <div className="flex min-w-0 items-center gap-2">
                {index === 0 && event ? (
                  <Trophy className="size-5 shrink-0 text-amber-400" />
                ) : event ? (
                  <CheckCircle2
                    className="size-5 shrink-0"
                    style={{ color: "var(--display-accent)" }}
                  />
                ) : (
                  <Clock3 className="size-5 shrink-0 text-slate-500" />
                )}
                <strong className="truncate">{target.agentName}</strong>
                <small className="truncate text-slate-400">{event?.summary || "进行中"}</small>
              </div>
              <time className="font-mono text-sm">
                {event ? formatTime(event.occurredAt) : "-"}
              </time>
              {config.showScore ? (
                <em className="font-mono text-lg not-italic">{event?.score ?? "-"}</em>
              ) : (
                <span />
              )}
            </article>
          ))}
        </section>
      ) : null}

      {started && config.layout === "timeline" ? (
        <section className="flex flex-1 flex-col gap-1.5">
          {data.events.length ? (
            data.events.map((event) => (
              <article
                className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-2.5"
                style={
                  config.showRecent && event.id === latestEventId
                    ? { boxShadow: "0 0 0 2px var(--display-accent)" }
                    : undefined
                }
                key={event.id}
              >
                <time className="w-20 shrink-0 font-mono text-sm text-slate-400">
                  {formatTime(event.occurredAt)}
                </time>
                <CheckCircle2
                  className="size-5 shrink-0"
                  style={{ color: "var(--display-accent)" }}
                />
                <div className="min-w-0 flex-1">
                  <strong className="block truncate">
                    {config.completionText.replaceAll("{agent}", event.agentName)}
                  </strong>
                  <p className="truncate text-sm text-slate-400">{event.summary}</p>
                </div>
                {config.showScore && event.score != null ? (
                  <em className="font-mono text-lg not-italic">{event.score}</em>
                ) : null}
              </article>
            ))
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-slate-400">
              <Clock3 className="size-8" />
              <h2 className="text-xl font-medium">等待第一个完成通知</h2>
            </div>
          )}
        </section>
      ) : null}

      <footer className="flex items-center justify-between text-sm text-slate-500">
        <span>{interaction.name}</span>
        <span>{live ? "完成状态自动更新" : started ? "最终结果" : ""}</span>
      </footer>
    </main>
  );
}
