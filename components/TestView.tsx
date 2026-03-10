import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { APP_THEME, SUBJECTS } from '../constants';
import { generateTestQuestions } from '../services/geminiService';
import { TestQuestion, UserProfile, TestResult, Subject } from '../types';
import { CheckCircle2, XCircle, ArrowRight, RefreshCcw, FileCheck, School, History, TrendingUp, ChevronLeft } from 'lucide-react';

interface TestViewProps {
  userProfile: UserProfile;
  history: TestResult[];
  onSaveResult: (result: TestResult) => void;
}

export const TestView: React.FC<TestViewProps> = ({ userProfile, history, onSaveResult }) => {
  const { tokens } = APP_THEME;
  const [viewState, setViewState] = useState<'setup' | 'loading' | 'playing' | 'results'>('setup');
  const [topic, setTopic] = useState('');
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedParentSubject, setSelectedParentSubject] = useState<Subject | null>(null);

  const handleSubjectSelect = (subject: Subject) => {
    if (subject.children) {
      setSelectedParentSubject(subject);
    } else {
      startTest(subject.name);
    }
  };

  const startTest = async (selectedTopic: string) => {
    setTopic(selectedTopic);
    setViewState('loading');
    try {
      const generatedQuestions = await generateTestQuestions(selectedTopic, userProfile, 3);
      setQuestions(generatedQuestions);
      setCurrentIndex(0);
      setScore(0);
      setSelectedOption(null);
      setShowExplanation(false);
      setViewState('playing');
    } catch (error) {
      console.error(error);
      alert('テストの作成に失敗しました。もう一度試してください。');
      setViewState('setup');
    }
  };

  const handleOptionSelect = (index: number) => {
    if (selectedOption !== null) return;
    
    setSelectedOption(index);
    setShowExplanation(true);
    if (index === questions[currentIndex].correctAnswerIndex) {
      setScore(prev => prev + 1);
    }
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setShowExplanation(false);
    } else {
      const result: TestResult = {
        id: Date.now().toString(),
        date: new Date().toLocaleDateString('ja-JP'),
        topic: topic,
        score: score,
        totalQuestions: questions.length
      };
      
      setViewState('results');
      onSaveResult(result);
    }
  };

  const resetTest = () => {
    setViewState('setup');
    setSelectedParentSubject(null);
  }

  if (viewState === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <FileCheck size={24} className="text-indigo-600" />
          </div>
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900">問題を作成中...</h3>
          <p className="text-slate-500 mt-2">
            AI講師が「{topic}」の{userProfile.targetUniversity ? `${userProfile.targetUniversity}対策` : ''}問題を厳選しています
          </p>
        </div>
      </div>
    );
  }

  if (viewState === 'setup') {
    const displaySubjects = selectedParentSubject ? selectedParentSubject.children || [] : SUBJECTS;

    return (
      <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium mb-3">
              <FileCheck size={16} />
              <span>実力確認テスト</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900">科目を選択してください</h2>
            <p className="text-slate-500 mt-1">
              {userProfile.targetUniversity 
                ? `${userProfile.targetUniversity}の入試傾向を反映した高品質な問題です。`
                : '共通テスト全教科対応。基礎から応用までチェック。'}
            </p>
          </div>
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <History size={18} />
            <span>{showHistory ? '科目を表示' : '履歴を表示'}</span>
          </button>
        </div>

        {showHistory ? (
          <div className="space-y-4">
            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
              <TrendingUp size={20} className="text-indigo-600" />
              学習履歴
            </h3>
            {history.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-100 text-slate-500">
                まだ履歴がありません。テストを受けてみましょう！
              </div>
            ) : (
              <div className="grid gap-3">
                {history.map((item) => (
                  <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center">
                    <div>
                      <p className="font-bold text-slate-800">{item.topic}</p>
                      <p className="text-xs text-slate-400">{item.date}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-xl font-bold text-indigo-600">{item.score}</span>
                        <span className="text-xs text-slate-400"> / {item.totalQuestions}</span>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center">
                         {item.score === item.totalQuestions ? (
                           <CheckCircle2 size={20} className="text-green-500" />
                         ) : (
                           <div className="text-xs font-bold text-slate-300">{(item.score/item.totalQuestions)*100}%</div>
                         )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            {selectedParentSubject && (
              <button 
                onClick={() => setSelectedParentSubject(null)}
                className="flex items-center gap-1 text-slate-500 hover:text-indigo-600 mb-4 transition-colors"
              >
                <ChevronLeft size={20} />
                <span>戻る</span>
              </button>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displaySubjects.map((subject) => (
                <button
                  key={subject.id}
                  onClick={() => handleSubjectSelect(subject)}
                  className={`${tokens.bgPanel} p-5 ${tokens.rounded} border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all text-left flex items-center justify-between group animate-in fade-in`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-lg text-slate-800">{subject.name}</span>
                  </div>
                  <span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                    <ArrowRight size={16} />
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (viewState === 'playing') {
    const question = questions[currentIndex];
    return (
      <div className="max-w-2xl mx-auto animate-in fade-in duration-300">
        <div className="mb-6 flex justify-between items-center text-sm font-medium text-slate-500">
          <span className="flex items-center gap-2">
            {topic}
            {userProfile.targetUniversity && (
              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded flex items-center gap-1">
                <School size={10} />
                {userProfile.targetUniversity}対策
              </span>
            )}
          </span>
          <span>問 {currentIndex + 1} / {questions.length}</span>
        </div>

        <div className="mb-8">
          <h3 className="text-xl md:text-2xl font-bold text-slate-900 leading-relaxed mb-6">
            {question.question}
          </h3>

          <div className="space-y-3">
            {question.options.map((option, idx) => {
              let stateStyle = "border-slate-200 hover:bg-slate-50 hover:border-slate-300";
              let icon = null;

              if (selectedOption !== null) {
                if (idx === question.correctAnswerIndex) {
                  stateStyle = "bg-green-50 border-green-500 text-green-900";
                  icon = <CheckCircle2 className="text-green-600" size={20} />;
                } else if (idx === selectedOption) {
                  stateStyle = "bg-red-50 border-red-500 text-red-900";
                  icon = <XCircle className="text-red-600" size={20} />;
                } else {
                  stateStyle = "opacity-50 border-slate-100";
                }
              }

              return (
                <button
                  key={idx}
                  disabled={selectedOption !== null}
                  onClick={() => handleOptionSelect(idx)}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center justify-between ${stateStyle} ${tokens.bgPanel}`}
                >
                  <span className="font-medium">{option}</span>
                  {icon}
                </button>
              );
            })}
          </div>
        </div>

        {showExplanation && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 bg-indigo-50 border border-indigo-100 p-5 rounded-xl mb-6">
            <h4 className="font-bold text-indigo-900 mb-2 flex items-center gap-2">
              <FileCheck size={18} /> 解説
            </h4>
            <div className="text-indigo-800 leading-relaxed text-sm md:text-base">
              <ReactMarkdown
                components={{
                   p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                   strong: ({node, ...props}) => <strong className="font-bold text-indigo-950" {...props} />,
                   ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-2" {...props} />,
                   li: ({node, ...props}) => <li className="mb-1" {...props} />,
                }}
              >
                {question.explanation}
              </ReactMarkdown>
            </div>
          </div>
        )}

        <div className="flex justify-end h-12">
          {selectedOption !== null && (
            <button
              onClick={nextQuestion}
              className={`${tokens.primary} px-6 py-2 rounded-xl font-medium flex items-center gap-2 shadow-lg animate-in fade-in`}
            >
              {currentIndex < questions.length - 1 ? '次の問題へ' : '結果を見る'}
              <ArrowRight size={18} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-10 animate-in zoom-in-95 duration-500">
      <div className="relative mb-8">
        <svg className="w-40 h-40 transform -rotate-90">
          <circle
            className="text-slate-100"
            strokeWidth="12"
            stroke="currentColor"
            fill="transparent"
            r="70"
            cx="80"
            cy="80"
          />
          <circle
            className={score === questions.length ? "text-yellow-400" : "text-indigo-600"}
            strokeWidth="12"
            strokeDasharray={440}
            strokeDashoffset={440 - (440 * score) / questions.length}
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
            r="70"
            cx="80"
            cy="80"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold text-slate-900">{Math.round((score / questions.length) * 100)}%</span>
          <span className="text-xs text-slate-500 uppercase tracking-wide">正解率</span>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-slate-900 mb-2">
        {score === questions.length ? '完璧です！素晴らしい！🎉' : 'お疲れ様でした！'}
      </h2>
      <p className="text-slate-500 mb-8">
        {questions.length}問中 {score}問正解しました
      </p>

      <div className="flex gap-4">
        <button
          onClick={resetTest}
          className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
        >
          他のトピック
        </button>
        <button
          onClick={() => startTest(topic)}
          className={`${tokens.primary} px-6 py-3 rounded-xl font-medium flex items-center gap-2 shadow-lg`}
        >
          <RefreshCcw size={18} />
          もう一度挑戦
        </button>
      </div>
    </div>
  );
};