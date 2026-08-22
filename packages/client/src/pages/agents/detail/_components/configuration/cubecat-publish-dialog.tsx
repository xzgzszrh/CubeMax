import {
  usePublishBuildingAgentToCubeCatMutation,
  useXiaozhiAgentEditorQuery,
  useXiaozhiAgentsQuery,
} from "@buildingai/services/web";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@buildingai/ui/components/ui/dialog";
import { Label } from "@buildingai/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@buildingai/ui/components/ui/select";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { Cpu, Info, Loader2, Radio, Sparkles, Volume2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type CubeCatPublishDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buildingAgentId: string;
  buildingAgentName?: string;
  promptPreview: string;
  openingStatement?: string;
};

function flattenVoices(
  voicesByLanguage: Record<string, Array<{ voice_id?: string; voice_name?: string }>>,
  language: string,
) {
  return (voicesByLanguage[language] || [])
    .map((voice) => ({
      id: String(voice.voice_id || "").trim(),
      name: String(voice.voice_name || voice.voice_id || "").trim(),
    }))
    .filter((voice) => voice.id);
}

export function CubeCatPublishDialog({
  open,
  onOpenChange,
  buildingAgentId,
  buildingAgentName,
  promptPreview,
  openingStatement,
}: CubeCatPublishDialogProps) {
  const { data: targetAgents = [], isLoading: agentsLoading } = useXiaozhiAgentsQuery({
    enabled: open,
  });
  const [targetAgentId, setTargetAgentId] = useState("");
  const [language, setLanguage] = useState("");
  const [model, setModel] = useState("");
  const [voice, setVoice] = useState("");

  const selectedTarget = targetAgents.find((agent) => agent.id === targetAgentId) || null;
  const editorQuery = useXiaozhiAgentEditorQuery(targetAgentId || null, {
    enabled: open && Boolean(targetAgentId),
  });
  const editor = editorQuery.data;
  const models = useMemo(
    () => (editor?.models || []).filter((item) => item.name?.trim()),
    [editor?.models],
  );
  const languages = useMemo(() => {
    const listed = editor?.ttsList?.languages?.filter(Boolean) || [];
    return listed.length ? listed : Object.keys(editor?.ttsList?.ttsVoices || {});
  }, [editor?.ttsList?.languages, editor?.ttsList?.ttsVoices]);
  const voices = useMemo(
    () => flattenVoices(editor?.ttsList?.ttsVoices || {}, language),
    [editor?.ttsList?.ttsVoices, language],
  );
  const publishMutation = usePublishBuildingAgentToCubeCatMutation(buildingAgentId);

  useEffect(() => {
    if (!open) return;
    const first = targetAgents[0];
    setTargetAgentId((current) =>
      targetAgents.some((agent) => agent.id === current) ? current : first?.id || "",
    );
  }, [open, targetAgents]);

  useEffect(() => {
    setLanguage("");
    setModel("");
    setVoice("");
  }, [targetAgentId]);

  useEffect(() => {
    if (!editor) return;
    const preferredLanguage = editor.config.language || languages[0] || "";
    setLanguage((current) =>
      current && languages.includes(current) ? current : preferredLanguage,
    );
    const preferredModel = editor.config.llm_model || models[0]?.name || "";
    setModel((current) =>
      current && models.some((item) => item.name === current) ? current : preferredModel,
    );
  }, [editor, languages, models]);

  useEffect(() => {
    if (!editor) return;
    const available = flattenVoices(editor.ttsList.ttsVoices || {}, language);
    const preferred = editor.config.tts_voice || available[0]?.id || "";
    setVoice((current) =>
      current && available.some((item) => item.id === current) ? current : preferred,
    );
  }, [editor, language]);

  const canSubmit = Boolean(
    editor &&
    targetAgentId &&
    model &&
    voice &&
    !editorQuery.isFetching &&
    !publishMutation.isPending,
  );

  const submit = async () => {
    if (!canSubmit) return;
    try {
      const result = await publishMutation.mutateAsync({
        targetAgentId,
        model,
        voice,
        language: language || undefined,
      });
      const affectedDevices = Number(result?.affectedDevices || selectedTarget?.deviceCount || 0);
      toast.success(
        affectedDevices > 0
          ? `已发布到方糖猫，配置将应用到 ${affectedDevices} 台设备`
          : "已发布到方糖猫",
      );
      onOpenChange(false);
    } catch {
      // The mutation's request error is surfaced by the shared API toast layer.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(760px,92dvh)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="size-5" />
            发布到方糖猫
          </DialogTitle>
          <DialogDescription>
            将「{buildingAgentName || "当前智能体"}」的角色设定同步到
            xiaozhi.me。设备端提示词由服务器自动生成。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <section className="bg-muted/45 space-y-3 rounded-lg border p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 size-4 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium">提示词预览</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  保存后的角色设定和开场白会在发布时合并；这里仅供确认，不会直接写入设备。
                </p>
              </div>
            </div>
            <Textarea
              readOnly
              value={[
                promptPreview.trim(),
                openingStatement?.trim() ? `对话开始时，请先说：${openingStatement.trim()}` : "",
              ]
                .filter(Boolean)
                .join("\n\n")}
              className="bg-background/70 min-h-28 resize-none text-sm leading-relaxed"
              placeholder="请先在功能配置中填写角色设定"
            />
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>发布目标</Label>
              <Select
                value={targetAgentId}
                onValueChange={setTargetAgentId}
                disabled={agentsLoading || publishMutation.isPending}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={agentsLoading ? "正在读取设备组…" : "选择方糖猫设备组"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {targetAgents.map((agent) => (
                    <SelectItem value={agent.id} key={agent.id}>
                      <span className="flex items-center gap-2">
                        <Cpu className="size-3.5" />
                        {agent.name}
                        <span className="text-muted-foreground text-xs">
                          {agent.deviceCount} 台设备
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTarget?.deviceCount && selectedTarget.deviceCount > 1 ? (
                <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <Info className="size-3.5" />
                  该设备组内的 {selectedTarget.deviceCount} 台方糖猫会共同使用此配置。
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>模型</Label>
              <Select
                value={model}
                onValueChange={setModel}
                disabled={editorQuery.isLoading || !models.length}
              >
                <SelectTrigger>
                  <SelectValue placeholder={editorQuery.isLoading ? "正在读取模型…" : "选择模型"} />
                </SelectTrigger>
                <SelectContent>
                  {models.map((item) => (
                    <SelectItem value={item.name} key={item.name}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>语言</Label>
              <Select
                value={language}
                onValueChange={setLanguage}
                disabled={editorQuery.isLoading || !languages.length}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择语言" />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((item) => (
                    <SelectItem value={item} key={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label className="flex items-center gap-2">
                <Volume2 className="size-4" />
                音色
              </Label>
              <Select
                value={voice}
                onValueChange={setVoice}
                disabled={editorQuery.isLoading || !voices.length}
              >
                <SelectTrigger>
                  <SelectValue placeholder={editorQuery.isLoading ? "正在读取音色…" : "选择音色"} />
                </SelectTrigger>
                <SelectContent>
                  {voices.map((item) => (
                    <SelectItem value={item.id} key={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!targetAgents.length && !agentsLoading ? (
            <div className="rounded-lg border border-dashed p-4 text-sm">
              <p className="font-medium">还没有可发布的方糖猫设备组</p>
              <p className="text-muted-foreground mt-1">
                请让老师或组织管理员在“讲台 &gt; 设备管理”中绑定 CubeCat 账号并分配设备。
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Badge variant="outline" className="mr-auto hidden sm:inline-flex">
            服务端校验模型与音色
          </Badge>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={publishMutation.isPending}
          >
            取消
          </Button>
          <Button onClick={() => void submit()} disabled={!canSubmit}>
            {publishMutation.isPending ? <Loader2 className="animate-spin" /> : <Radio />}
            {publishMutation.isPending ? "发布中…" : "确定发布"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
