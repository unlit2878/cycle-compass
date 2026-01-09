import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ChevronLeft, Droplets, Save } from 'lucide-react';
import { DailyLog } from '@/lib/db';
import { formatFullDate } from '@/lib/cycle-utils';
import { zh } from '@/lib/i18n';

interface LoggingScreenProps {
  date: string;
  existingLog?: DailyLog;
  onSave: (data: Omit<DailyLog, 'id' | 'date' | 'createdAt' | 'updatedAt'>) => void;
  onBack: () => void;
}

type FlowIntensity = 'light' | 'medium' | 'heavy';

export function LoggingScreen({ date, existingLog, onSave, onBack }: LoggingScreenProps) {
  const [isPeriod, setIsPeriod] = useState(existingLog?.isPeriod ?? false);
  const [flowIntensity, setFlowIntensity] = useState<FlowIntensity | undefined>(
    existingLog?.flowIntensity
  );
  const [symptoms, setSymptoms] = useState<string[]>(existingLog?.symptoms ?? []);
  const [mood, setMood] = useState<string | undefined>(existingLog?.mood);
  const [notes, setNotes] = useState(existingLog?.notes ?? '');

  const displayDate = new Date(date + 'T12:00:00');

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

  const flowOptions: { value: FlowIntensity; label: string; drops: number }[] = [
    { value: 'light', label: zh.flowIntensity.light, drops: 1 },
    { value: 'medium', label: zh.flowIntensity.medium, drops: 2 },
    { value: 'heavy', label: zh.flowIntensity.heavy, drops: 3 },
  ];

  return (
    <div className="min-h-screen pb-24 px-4 pt-6">
      {/* 头部 */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground">{zh.logging.title}</h1>
          <p className="text-sm text-muted-foreground">{formatFullDate(displayDate)}</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* 月经开关 */}
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-phase-menstrual/20 flex items-center justify-center">
                  <Droplets className="w-5 h-5 text-phase-menstrual" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{zh.phases.menstrual}</p>
                  <p className="text-sm text-muted-foreground">{zh.logging.isPeriod}</p>
                </div>
              </div>
              <Switch
                checked={isPeriod}
                onCheckedChange={setIsPeriod}
              />
            </div>

            {/* 经量 */}
            {isPeriod && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-medium text-foreground mb-3">{zh.logging.flowIntensity}</p>
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
              </div>
            )}
          </CardContent>
        </Card>

        {/* 症状 */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-4">
            <p className="font-medium text-foreground mb-3">{zh.logging.symptoms}</p>
            <div className="flex flex-wrap gap-2">
              {zh.symptoms.map((symptom) => (
                <button
                  key={symptom}
                  onClick={() => toggleSymptom(symptom)}
                  className={`px-3 py-2 rounded-full text-sm transition-all ${
                    symptoms.includes(symptom)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {symptom}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 心情 */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-4">
            <p className="font-medium text-foreground mb-3">{zh.logging.howFeeling}</p>
            <div className="grid grid-cols-4 gap-2">
              {zh.moods.map((m) => (
                <button
                  key={m.label}
                  onClick={() => setMood(mood === m.label ? undefined : m.label)}
                  className={`py-3 rounded-xl transition-all flex flex-col items-center gap-1 ${
                    mood === m.label
                      ? 'bg-primary/10 ring-2 ring-primary'
                      : 'bg-muted'
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
        <Card className="border-0 shadow-lg">
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
        <Button onClick={handleSave} className="w-full h-14 text-lg rounded-2xl">
          <Save className="mr-2 w-5 h-5" />
          {zh.logging.save}
        </Button>
      </div>
    </div>
  );
}
