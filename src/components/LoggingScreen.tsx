import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, Droplets, Save, Play, Square, Calendar } from 'lucide-react';
import { DailyLog, Settings } from '@/lib/db';
import { formatFullDate } from '@/lib/cycle-utils';
import { zh } from '@/lib/i18n';

interface LoggingScreenProps {
  date: string;
  existingLog?: DailyLog;
  settings?: Settings | null;
  isInPeriod?: boolean;
  onSave: (data: Omit<DailyLog, 'id' | 'date' | 'createdAt' | 'updatedAt'>) => void;
  onStartPeriod?: (date: string, autoFillDays: number) => void;
  onEndPeriod?: (date: string) => void;
  onBack: () => void;
}

type FlowIntensity = 'light' | 'medium' | 'heavy';

export function LoggingScreen({ 
  date, 
  existingLog, 
  settings,
  isInPeriod = false,
  onSave, 
  onStartPeriod,
  onEndPeriod,
  onBack 
}: LoggingScreenProps) {
  const [isPeriod, setIsPeriod] = useState(existingLog?.isPeriod ?? false);
  const [flowIntensity, setFlowIntensity] = useState<FlowIntensity | undefined>(
    existingLog?.flowIntensity
  );
  const [symptoms, setSymptoms] = useState<string[]>(existingLog?.symptoms ?? []);
  const [mood, setMood] = useState<string | undefined>(existingLog?.mood);
  const [notes, setNotes] = useState(existingLog?.notes ?? '');

  const displayDate = new Date(date + 'T12:00:00');
  const avgPeriodLength = settings?.averagePeriodLength || 5;

  const toggleSymptom = (symptom: string) => {
    setSymptoms((prev) =>
      prev.includes(symptom) ? prev.filter((s) => s !== symptom) : [...prev, symptom]
    );
  };

  const handleSave = () => {
    onSave({
      isPeriod,
      flowIntensity: isPeriod ? flowIntensity : undefined,
      symptoms,
      mood,
      notes: notes.trim() || undefined,
    });
  };

  const handleStartPeriod = () => {
    if (onStartPeriod) {
      onStartPeriod(date, avgPeriodLength);
    }
  };

  const handleEndPeriod = () => {
    if (onEndPeriod) {
      onEndPeriod(date);
    }
  };

  const flowOptions: { value: FlowIntensity; label: string; drops: number }[] = [
    { value: 'light', label: zh.flowIntensity.light, drops: 1 },
    { value: 'medium', label: zh.flowIntensity.medium, drops: 2 },
    { value: 'heavy', label: zh.flowIntensity.heavy, drops: 3 },
  ];

  // 判断是否显示"标记开始"按钮（如果当前在经期中则禁用）
  const showStartButton = onStartPeriod && !isInPeriod;
  const showEndButton = onEndPeriod;

  return (
    <div className="min-h-screen pb-24 px-4 pt-6 page-enter">
      {/* 头部 */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full btn-press">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground">{zh.logging.title}</h1>
          <p className="text-sm text-muted-foreground">{formatFullDate(displayDate)}</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* 快捷操作：标记经期开始/结束 */}
        {(showStartButton || showEndButton) && (
          <Card className="border-0 shadow-lg overflow-hidden bg-gradient-to-r from-phase-menstrual/10 to-phase-menstrual/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <Calendar className="w-5 h-5 text-phase-menstrual" />
                <span className="font-medium text-foreground">快捷操作</span>
              </div>
              <div className="flex gap-2">
                {showStartButton && (
                  <Button
                    onClick={handleStartPeriod}
                    className="flex-1 bg-phase-menstrual hover:bg-phase-menstrual/90 text-white gap-2"
                  >
                    <Play className="w-4 h-4" />
                    标记经期开始
                  </Button>
                )}
                {showEndButton && (
                  <Button
                    onClick={handleEndPeriod}
                    variant="outline"
                    className="flex-1 border-phase-menstrual text-phase-menstrual hover:bg-phase-menstrual/10 gap-2"
                  >
                    <Square className="w-4 h-4" />
                    标记经期结束
                  </Button>
                )}
              </div>
              {showStartButton && (
                <p className="text-xs text-muted-foreground mt-2">
                  点击"标记经期开始"将自动填充未来 {avgPeriodLength} 天为经期
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* 经量选择（仅当有经期记录时显示） */}
        {isPeriod && (
          <Card className="border-0 shadow-lg overflow-hidden card-hover">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-phase-menstrual/20 flex items-center justify-center">
                  <Droplets className="w-5 h-5 text-phase-menstrual" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{zh.logging.flowIntensity}</p>
                  <p className="text-sm text-muted-foreground">选择今天的经量</p>
                </div>
              </div>
              <div className="flex gap-2">
                {flowOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setFlowIntensity(option.value)}
                    className={`flex-1 py-3 px-2 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                      flowIntensity === option.value
                        ? 'border-phase-menstrual bg-phase-menstrual/10'
                        : 'border-border'
                    }`}
                  >
                    <div className="flex">
                      {Array.from({ length: option.drops }).map((_, i) => (
                        <Droplets
                          key={i}
                          className={`w-4 h-4 ${
                            flowIntensity === option.value
                              ? 'text-phase-menstrual'
                              : 'text-muted-foreground'
                          }`}
                        />
                      ))}
                    </div>
                    <span
                      className={`text-xs ${
                        flowIntensity === option.value
                          ? 'text-phase-menstrual font-medium'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 症状 */}
        <Card className="border-0 shadow-lg card-hover">
          <CardContent className="p-4">
            <p className="font-medium text-foreground mb-3">{zh.logging.symptoms}</p>
            <div className="flex flex-wrap gap-2">
              {zh.symptoms.map((symptom) => (
                <button
                  key={symptom}
                  onClick={() => toggleSymptom(symptom)}
                  className={`px-3 py-2 rounded-full text-sm transition-all duration-200 btn-press ${
                    symptoms.includes(symptom)
                      ? 'bg-primary text-primary-foreground scale-105'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {symptom}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 心情 */}
        <Card className="border-0 shadow-lg card-hover">
          <CardContent className="p-4">
            <p className="font-medium text-foreground mb-3">{zh.logging.howFeeling}</p>
            <div className="grid grid-cols-4 gap-2">
              {zh.moods.map((m) => (
                <button
                  key={m.label}
                  onClick={() => setMood(mood === m.label ? undefined : m.label)}
                  className={`py-3 rounded-xl transition-all duration-200 btn-press flex flex-col items-center gap-1 ${
                    mood === m.label
                      ? 'bg-primary/10 ring-2 ring-primary scale-105'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  <span className="text-2xl">{m.emoji}</span>
                  <span className="text-xs text-muted-foreground">{m.label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 备注 */}
        <Card className="border-0 shadow-lg card-hover">
          <CardContent className="p-4">
            <p className="font-medium text-foreground mb-3">{zh.logging.notes}</p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={zh.logging.notesPlaceholder}
              className="min-h-24 resize-none rounded-xl"
            />
          </CardContent>
        </Card>

        {/* 保存按钮 */}
        <Button onClick={handleSave} className="w-full h-14 text-lg rounded-2xl btn-press transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5">
          <Save className="mr-2 w-5 h-5" />
          {zh.logging.save}
        </Button>
      </div>
    </div>
  );
}
