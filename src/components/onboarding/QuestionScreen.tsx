import { ReactNode } from 'react';

interface QuestionScreenProps {
  title: string;
  helper?: string;
  children?: ReactNode;
  align?: 'left' | 'center';
}

export function QuestionScreen({ title, helper, children, align = 'left' }: QuestionScreenProps) {
  const textAlign = align === 'center' ? 'text-center' : 'text-left';

  return (
    <div className="h-full flex flex-col">
      <div className={`space-y-2 ${textAlign}`}>
        <h1 className="font-display text-3xl md:text-4xl leading-tight">{title}</h1>
        {helper && <p className="text-muted-foreground text-sm md:text-base">{helper}</p>}
      </div>
      <div className="mt-8 flex-1">{children}</div>
    </div>
  );
}
