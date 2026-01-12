import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, Droplets, Save, Play, Square, Calendar, Edit, Trash2, AlertTriangle } from 'lucide-react';
import { DailyLog, Settings, CycleData, getCycleByDate, updateCycle, deleteCycle, addOrUpdateDailyLog, getAllCycles } from '@/lib/db';
import { formatFullDate, formatDate } from '@/lib/cycle-utils';
import { zh } from '@/lib/i18n';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface LoggingScreenProps {
  date: string;
  existingLog?: DailyLog;
  settings?: Settings | null;
  isInPeriod?: boolean;
  onSave: (data: Omit<DailyLog, 'id' | 'date' | 'createdAt' | 'updatedAt'>) => void;
  onStartPeriod?: (date: string, autoFillDays: number) => void;
  onEndPeriod?: (date: string) => void;
  onBack: () => void;
  onRefresh?: () => void;
  onDeleteLog?: (date: string) => Promise<void>;
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
  onBack,
  onRefresh,
  onDeleteLog,
}: LoggingScreenProps) {
  // isPeriod 从 cycles 表判断，不再存储在 dailyLogs 中
  const [isPeriod, setIsPeriod] = useState(false);
  const [flowIntensity, setFlowIntensity] = useState<FlowIntensity | undefined>(
    existingLog?.flowIntensity
  );
  const [symptoms, setSymptoms] = useState<string[]>(existingLog?.symptoms ?? []);
  const [mood, setMood] = useState<string | undefined>(existingLog?.mood);
  const [notes, setNotes] = useState(existingLog?.notes ?? '');
  
  // 编辑经期相关状态
  const [relatedCycle, setRelatedCycle] = useState<CycleData | null>(null);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLogDialogOpen, setDeleteLogDialogOpen] = useState(false);

  const displayDate = new Date(date + 'T12:00:00');
  const avgPeriodLength = settings?.averagePeriodLength || 5;

  // 加载相关周期记录并判断是否在经期中
  useEffect(() => {
    const loadCycle = async () => {
      const cycle = await getCycleByDate(date);
      if (cycle) {
        setRelatedCycle(cycle);
        setEditStartDate(cycle.startDate);
        setEditEndDate(cycle.endDate || '');
        setIsPeriod(true); // 如果在 cycle 范围内，则是经期
      } else {
        setIsPeriod(false);
      }
    };
    loadCycle();
  }, [date]);

  const toggleSymptom = (symptom: string) => {
    setSymptoms((prev) =>
      prev.includes(symptom) ? prev.filter((s) => s !== symptom) : [...prev, symptom]
    );
  };

  const handleSave = () => {
    // 只保存用户主动记录的内容，不再包含 isPeriod
    onSave({
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

  // 保存编辑的周期（只更新 cycles 表）
  const handleSaveCycleEdit = async () => {
    if (!relatedCycle?.id) return;
    
    try {
      // 更新周期记录
      await updateCycle(relatedCycle.id, {
        startDate: editStartDate,
        endDate: editEndDate || undefined,
      });
      
      toast.success('经期记录已更新');
      setEditDialogOpen(false);
      onRefresh?.();
      onBack();
    } catch (error) {
      console.error('更新失败:', error);
      toast.error('更新失败');
    }
  };

  // 删除周期记录（只删除 cycles 表记录）
  const handleDeleteCycle = async () => {
    if (!relatedCycle?.id) return;
    
    try {
      // 删除周期记录
      await deleteCycle(relatedCycle.id);
      
      toast.success('经期记录已删除');
      setDeleteDialogOpen(false);
      onRefresh?.();
      onBack();
    } catch (error) {
      console.error('删除失败:', error);
      toast.error('删除失败');
    }
  };

  // 删除日志记录
  const handleDeleteLog = async () => {
    if (!onDeleteLog) return;
    
    try {
      await onDeleteLog(date);
      toast.success('记录已删除');
      setDeleteLogDialogOpen(false);
      onBack();
    } catch (error) {
      console.error('删除失败:', error);
      toast.error('删除失败');
    }
  };

  const flowOptions: { value: FlowIntensity; label: string; drops: number }[] = [
    { value: 'light', label: zh.flowIntensity.light, drops: 1 },
    { value: 'medium', label: zh.flowIntensity.medium, drops: 2 },
    { value: 'heavy', label: zh.flowIntensity.heavy, drops: 3 },
  ];

  // 始终显示两个按钮，但在经期中时禁用"标记开始"按钮
  const showStartButton = !!onStartPeriod;
  const showEndButton = !!onEndPeriod;

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
                    disabled={isInPeriod}
                    className="flex-1 bg-phase-menstrual hover:bg-phase-menstrual/90 text-white gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
              
              {/* 编辑已有周期记录 */}
              {relatedCycle && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <p className="text-xs text-muted-foreground mb-2">
                    当前经期记录: {relatedCycle.startDate} 至 {relatedCycle.endDate || '进行中'}
                  </p>
                  <div className="flex gap-2">
                    <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1 gap-1">
                          <Edit className="w-3 h-3" />
                          修改日期
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>修改经期日期</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div>
                            <label className="text-sm font-medium mb-2 block">开始日期</label>
                            <Input
                              type="date"
                              value={editStartDate}
                              onChange={(e) => setEditStartDate(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium mb-2 block">结束日期</label>
                            <Input
                              type="date"
                              value={editEndDate}
                              onChange={(e) => setEditEndDate(e.target.value)}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <DialogClose asChild>
                            <Button variant="outline">取消</Button>
                          </DialogClose>
                          <Button onClick={handleSaveCycleEdit}>保存</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    
                    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1 text-destructive border-destructive/50 hover:bg-destructive/10">
                          <Trash2 className="w-3 h-3" />
                          删除记录
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-3xl mx-4 max-w-sm">
                        <div className="flex flex-col items-center text-center py-4">
                          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                            <AlertTriangle className="w-8 h-8 text-destructive" />
                          </div>
                          <AlertDialogTitle className="text-xl mb-2">确认删除？</AlertDialogTitle>
                          <AlertDialogDescription className="text-muted-foreground">
                            删除此经期记录后无法恢复
                          </AlertDialogDescription>
                        </div>
                        <AlertDialogFooter className="flex-row gap-3 sm:gap-3">
                          <AlertDialogCancel className="flex-1 rounded-xl h-12 mt-0">取消</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={handleDeleteCycle}
                            className="flex-1 rounded-xl h-12 bg-destructive hover:bg-destructive/90"
                          >
                            删除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
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

        {/* 删除记录按钮（仅当有现有记录时显示） */}
        {existingLog && onDeleteLog && (
          <AlertDialog open={deleteLogDialogOpen} onOpenChange={setDeleteLogDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full h-12 text-destructive border-destructive/50 hover:bg-destructive/10 rounded-2xl"
              >
                <Trash2 className="mr-2 w-4 h-4" />
                删除此日记录
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-3xl mx-4 max-w-sm">
              <div className="flex flex-col items-center text-center py-4">
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                  <AlertTriangle className="w-8 h-8 text-destructive" />
                </div>
                <AlertDialogTitle className="text-xl mb-2">确认删除？</AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground">
                  删除 {formatFullDate(displayDate)} 的记录后无法恢复
                </AlertDialogDescription>
              </div>
              <AlertDialogFooter className="flex-row gap-3 sm:gap-3">
                <AlertDialogCancel className="flex-1 rounded-xl h-12 mt-0">取消</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleDeleteLog}
                  className="flex-1 rounded-xl h-12 bg-destructive hover:bg-destructive/90"
                >
                  删除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
