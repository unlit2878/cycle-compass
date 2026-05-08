import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Slider } from '@/components/ui/slider';
import { ArrowRight, ArrowLeft, Upload } from 'lucide-react';
import { zh, formatDateChinese } from '@/lib/i18n';
import { formatDate } from '@/lib/cycle-utils';
import { zhCN } from 'date-fns/locale';

interface OnboardingProps {
  onComplete: (lastPeriodStart: string, cycleLength: number, periodLength: number, lastPeriodEnd?: string) => void;
  onImport: () => void;
}

export function Onboarding({ onComplete, onImport }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [cycleLength, setCycleLength] = useState(28);
  const [periodLength, setPeriodLength] = useState(5);

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else if (selectedDate) {
      const startDate = new Date(selectedDate);
      startDate.setHours(12, 0, 0, 0);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + periodLength - 1);
      onComplete(formatDate(startDate), cycleLength, periodLength, formatDate(endDate));
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const canProceed = step === 0 || (step === 1 && selectedDate) || step === 2 || step === 3;

  return (
    <div className="onboarding-screen min-h-screen flex flex-col items-center justify-center p-6 gradient-soft">
      {/* 进度指示器 */}
      <div className="flex gap-2 mb-8">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all ${
              i <= step ? 'bg-primary w-6' : 'bg-primary/30'
            }`}
          />
        ))}
      </div>

      {/* 步骤内容 */}
      <div className="w-full max-w-md">
        {step === 0 && (
          <div className="text-center space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="onboarding-app-icon animate-float">
              <img src="/decor/app_icon.png" alt="知期" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">{zh.onboarding.welcome.title}</h1>
            <p className="text-muted-foreground text-lg">
              {zh.onboarding.welcome.subtitle}
              <br />
              {zh.onboarding.welcome.description}
            </p>
            <div className="pt-4 space-y-3">
              <Button onClick={handleNext} className="w-full h-14 text-lg rounded-2xl">
                {zh.onboarding.welcome.getStarted}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                onClick={onImport}
                className="w-full text-muted-foreground"
              >
                <Upload className="mr-2 w-4 h-4" />
                {zh.onboarding.welcome.importData}
              </Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground">{zh.onboarding.lastPeriodStart.title}</h2>
              <p className="text-muted-foreground mt-2">
                {zh.onboarding.lastPeriodStart.subtitle}
              </p>
            </div>
            <div className="onboarding-calendar-panel">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => date > new Date()}
                locale={zhCN}
                className="onboarding-calendar"
                classNames={{
                  months: 'onboarding-calendar-months',
                  month: 'onboarding-calendar-month',
                  caption: 'onboarding-calendar-caption',
                  caption_label: 'onboarding-calendar-caption-label',
                  nav: 'onboarding-calendar-nav',
                  nav_button: 'onboarding-calendar-nav-button',
                  nav_button_previous: 'onboarding-calendar-nav-previous',
                  nav_button_next: 'onboarding-calendar-nav-next',
                  table: 'onboarding-calendar-table',
                  head_row: 'onboarding-calendar-head-row',
                  head_cell: 'onboarding-calendar-head-cell',
                  row: 'onboarding-calendar-row',
                  cell: 'onboarding-calendar-cell',
                  day: 'onboarding-calendar-day',
                  day_selected: 'onboarding-calendar-day-selected',
                  day_today: 'onboarding-calendar-day-today',
                  day_outside: 'onboarding-calendar-day-outside',
                  day_disabled: 'onboarding-calendar-day-disabled',
                  day_hidden: 'invisible',
                }}
              />
            </div>
            {selectedDate && (
              <p className="text-center text-primary font-medium">
                已选择：{formatDateChinese(selectedDate)}
              </p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground">{zh.onboarding.cycleLength.title}</h2>
              <p className="text-muted-foreground mt-2">
                {zh.onboarding.cycleLength.subtitle}
              </p>
            </div>
            <div className="text-center">
              <div className="text-6xl font-bold text-primary mb-2">{cycleLength}</div>
              <div className="text-muted-foreground">{zh.onboarding.cycleLength.days}</div>
            </div>
            <div className="px-4">
              <Slider
                value={[cycleLength]}
                onValueChange={(v) => setCycleLength(v[0])}
                min={21}
                max={40}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-muted-foreground mt-2">
                <span>21 {zh.onboarding.cycleLength.days}</span>
                <span>40 {zh.onboarding.cycleLength.days}</span>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground">{zh.onboarding.periodLength.title}</h2>
              <p className="text-muted-foreground mt-2">
                {zh.onboarding.periodLength.subtitle}
              </p>
            </div>
            <div className="text-center">
              <div className="text-6xl font-bold text-primary mb-2">{periodLength}</div>
              <div className="text-muted-foreground">{zh.onboarding.cycleLength.days}</div>
            </div>
            <div className="px-4">
              <Slider
                value={[periodLength]}
                onValueChange={(v) => setPeriodLength(v[0])}
                min={2}
                max={10}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-muted-foreground mt-2">
                <span>2 {zh.onboarding.cycleLength.days}</span>
                <span>10 {zh.onboarding.cycleLength.days}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 导航按钮 */}
      {step > 0 && (
        <div className="w-full max-w-md mt-8 flex gap-3">
          <Button
            variant="outline"
            onClick={handleBack}
            className="flex-1 h-14 rounded-2xl"
          >
            <ArrowLeft className="mr-2 w-5 h-5" />
            {zh.onboarding.back}
          </Button>
          <Button
            onClick={handleNext}
            disabled={!canProceed}
            className="flex-1 h-14 rounded-2xl"
          >
            {step === 3 ? zh.onboarding.complete : zh.onboarding.next}
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      )}
    </div>
  );
}
