import React, { useState, useEffect } from 'react';

interface BirthdayPickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export default function BirthdayPicker({ value, onChange, label }: BirthdayPickerProps) {
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');

  useEffect(() => {
    if (value) {
      const [y, m, d] = value.split('-');
      setYear(y || '');
      setMonth(m || '');
      setDay(d || '');
    } else {
      setYear('');
      setMonth('');
      setDay('');
    }
  }, [value]);

  const years = Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i);
  const months = [
    { value: '01', label: 'Janeiro' },
    { value: '02', label: 'Fevereiro' },
    { value: '03', label: 'Março' },
    { value: '04', label: 'Abril' },
    { value: '05', label: 'Maio' },
    { value: '06', label: 'Junho' },
    { value: '07', label: 'Julho' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' },
  ];

  const getDaysInMonth = (y: string, m: string) => {
    if (!y || !m) return 31;
    return new Date(parseInt(y), parseInt(m), 0).getDate();
  };

  const days = Array.from({ length: getDaysInMonth(year, month) }, (_, i) => 
    (i + 1).toString().padStart(2, '0')
  );

  const handleDateChange = (newY: string, newM: string, newD: string) => {
    if (newY && newM && newD) {
      onChange(`${newY}-${newM}-${newD}`);
    } else if (!newY && !newM && !newD) {
      onChange('');
    }
  };

  return (
    <div className="space-y-2">
      {label && <label className="text-xs font-bold uppercase text-church-navy/60">{label}</label>}
      <div className="grid grid-cols-3 gap-2">
        <select
          value={day}
          onChange={(e) => {
            setDay(e.target.value);
            handleDateChange(year, month, e.target.value);
          }}
          className="rounded-xl border border-church-gold/20 px-2 py-3 text-sm font-medium text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none h-[50px] bg-white"
        >
          <option value="">Dia</option>
          {days.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <select
          value={month}
          onChange={(e) => {
            setMonth(e.target.value);
            handleDateChange(year, e.target.value, day);
          }}
          className="rounded-xl border border-church-gold/20 px-2 py-3 text-sm font-medium text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none h-[50px] bg-white"
        >
          <option value="">Mês</option>
          {months.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>

        <select
          value={year}
          onChange={(e) => {
            setYear(e.target.value);
            handleDateChange(e.target.value, month, day);
          }}
          className="rounded-xl border border-church-gold/20 px-2 py-3 text-sm font-medium text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none h-[50px] bg-white"
        >
          <option value="">Ano</option>
          {years.map((y) => (
            <option key={y} value={y.toString()}>
              {y}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
