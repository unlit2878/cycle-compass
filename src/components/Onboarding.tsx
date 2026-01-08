import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Sparkles, ArrowRight, ArrowLeft, Upload } from 'lucide-react';

interface OnboardingProps {
  onComplete: (lastPeriodStart: string, cycleLength: number) => void;
  onImport: () => void;
}

export function Onboarding({ onComplete, onImport }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [cycleLength, setCycleLength] = useState(28);

  const handleNext = () => {
    if (step < 2) {
      setStep(step + 1);
    } else if (selectedDate) {
      onComplete(selectedDate.toISOString().split('T')[0], cycleLength);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const canProceed = step === 0 || (step === 1 && selectedDate) || step === 2;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gradient-soft">
      {/* Progress indicator */}
      <div className="flex gap-2 mb-8">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all ${
              i <= step ? 'bg-primary w-6' : 'bg-primary/30'
            }`}
          />
        ))}
      </div>

      {/* Step content */}
      <div className="w-full max-w-md">
        {step === 0 && (
          <div className="text-center space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="w-24 h-24 mx-auto rounded-full gradient-primary flex items-center justify-center animate-float">
              <Sparkles className="w-12 h-12 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">Welcome to MyCycle</h1>
            <p className="text-muted-foreground text-lg">
              Your personal, private menstrual cycle companion. All your data stays on your device.
            </p>
            <div className="pt-4 space-y-3">
              <Button onClick={handleNext} className="w-full h-14 text-lg rounded-2xl">
                Get Started
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                onClick={onImport}
                className="w-full text-muted-foreground"
              >
                <Upload className="mr-2 w-4 h-4" />
                Import existing data
              </Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground">When did your last period start?</h2>
              <p className="text-muted-foreground mt-2">
                This helps us predict your cycle
              </p>
            </div>
            <Card className="border-0 shadow-lg">
              <CardContent className="p-4">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date > new Date()}
                  className="rounded-xl"
                />
              </CardContent>
            </Card>
            {selectedDate && (
              <p className="text-center text-primary font-medium">
                Selected: {selectedDate.toLocaleDateString('en-US', { 
                  month: 'long', 
                  day: 'numeric',
                  year: 'numeric'
                })}
              </p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground">How long is your typical cycle?</h2>
              <p className="text-muted-foreground mt-2">
                Most cycles are between 21-35 days
              </p>
            </div>
            <div className="text-center">
              <div className="text-6xl font-bold text-primary mb-2">{cycleLength}</div>
              <div className="text-muted-foreground">days</div>
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
                <span>21 days</span>
                <span>40 days</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      {step > 0 && (
        <div className="w-full max-w-md mt-8 flex gap-3">
          <Button
            variant="outline"
            onClick={handleBack}
            className="flex-1 h-14 rounded-2xl"
          >
            <ArrowLeft className="mr-2 w-5 h-5" />
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={!canProceed}
            className="flex-1 h-14 rounded-2xl"
          >
            {step === 2 ? 'Start Tracking' : 'Next'}
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      )}
    </div>
  );
}
