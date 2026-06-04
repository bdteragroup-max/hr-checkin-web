"use client";

import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from "recharts";
import { 
  UsersIcon, UserGroupIcon, UserIcon, UserPlusIcon, ArrowRightStartOnRectangleIcon, 
  ArrowUpIcon, ArrowDownIcon
} from "@heroicons/react/24/outline";
import styles from "./HRDashboard.module.css";

// --- MOCK DATA ---
const deptData = [
  { name: 'ฝ่ายบริหาร', value: 25 },
  { name: 'ฝ่ายการตลาด', value: 40 },
  { name: 'ฝ่ายขาย', value: 60 },
  { name: 'ฝ่ายปฏิบัติการ', value: 70 },
  { name: 'ฝ่ายสนับสนุน', value: 35 },
  { name: 'ฝ่ายไอที', value: 36 },
];

const GENDER_COLORS = ['#3b82f6', '#ec4899', '#f59e0b'];



const LEAVE_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316', '#6366f1'];





interface HRData {
  total: number;
  totalDiff: number;
  permanent: number;
  temporary: number;
  newHires: number;
  newHiresDiff: number;
  resigned: number;
  resignedDiff: number;
}

interface ChartData {
  name: string;
  value: number;
}

export default function HRDashboard() {
  const [data, setData] = React.useState<HRData | null>(null);
  const [deptChartData, setDeptChartData] = React.useState<ChartData[]>([]);
  const [genderChartData, setGenderChartData] = React.useState<ChartData[]>([]);
  const [ageChartData, setAgeChartData] = React.useState<ChartData[]>([]);
  const [turnoverChartData, setTurnoverChartData] = React.useState<{month: string; rate: number; resigned: number}[]>([]);
  const [leaveChartData, setLeaveChartData] = React.useState<{types: string[], data: any[], summary?: any[], totalDays?: number, totalRequests?: number}>({types: [], data: []});
  const [selectedLeaveType, setSelectedLeaveType] = React.useState<string>('all');
  const [newResignedChartData, setNewResignedChartData] = React.useState<ChartData[]>([]);
  const [expiringContractsData, setExpiringContractsData] = React.useState<{name: string, role: string, dept: string, date: string}[]>([]);
  const [performancesData, setPerformancesData] = React.useState<{grade: string, count: number, pct: string, badge: string}[]>([]);
  const [trainingData, setTrainingData] = React.useState<{totalEmployees: number, trainedEmployees: number, percentage: number, recentTrainings: any[]}>({totalEmployees: 0, trainedEmployees: 0, percentage: 0, recentTrainings: []});
  
  // Date Filters
  const [startDate, setStartDate] = React.useState<string>('');
  const [endDate, setEndDate] = React.useState<string>('');

  React.useEffect(() => {
    let url = '/api/admin/dashboard/hr';
    if (startDate && endDate) {
      url += `?start=${startDate}&end=${endDate}`;
    }

    fetch(url)
      .then(res => res.json())
      .then(res => {
        if (res.ok) {
          if (res.kpis) setData(res.kpis);
          if (res.charts?.deptData) setDeptChartData(res.charts.deptData);
          if (res.charts?.genderData) setGenderChartData(res.charts.genderData);
          if (res.charts?.ageData) setAgeChartData(res.charts.ageData);
          if (res.charts?.turnoverData) setTurnoverChartData(res.charts.turnoverData);
          if (res.charts?.leaveData) setLeaveChartData(res.charts.leaveData);
          if (res.charts?.newResignedData) setNewResignedChartData(res.charts.newResignedData);
          if (res.charts?.expiringContracts) setExpiringContractsData(res.charts.expiringContracts);
          if (res.charts?.performances) setPerformancesData(res.charts.performances);
          if (res.charts?.training) setTrainingData(res.charts.training);
        }
      })
      .catch(err => console.error("Error loading HR Data", err));
  }, [startDate, endDate]);

  return (
    <div className={styles.dashboardContainer}>

      {/* Date Filter */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20, gap: 10, alignItems: 'center' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#475569' }}>กรองข้อมูล:</span>
        <input 
          type="date" 
          value={startDate} 
          onChange={e => setStartDate(e.target.value)} 
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5e1', outline: 'none' }} 
        />
        <span style={{ fontSize: 14, color: '#475569' }}>ถึง</span>
        <input 
          type="date" 
          value={endDate} 
          onChange={e => setEndDate(e.target.value)} 
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5e1', outline: 'none' }} 
        />
        {(startDate || endDate) && (
          <button 
            onClick={() => { setStartDate(''); setEndDate(''); }}
            style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#f1f5f9', color: '#64748b', cursor: 'pointer', fontWeight: 600 }}
          >
            ล้างตัวกรอง
          </button>
        )}
      </div>
      
      {/* 1. KPI Cards */}
      <div className={styles.kpiRow}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <div className={styles.kpiIconWrapper} style={{ background: '#eff6ff', color: '#3b82f6' }}>
              <UsersIcon width={24} />
            </div>
            <div className={styles.kpiTitle}>จำนวนพนักงานทั้งหมด</div>
          </div>
          <div className={styles.kpiValue}>{data?.total ?? 0} <span style={{fontSize: 14, fontWeight: 600, color: '#64748b'}}>คน</span></div>
          <div className={styles.kpiSub}>
            {data && data.totalDiff >= 0 ? (
              <><span style={{ color: '#16a34a', display: 'flex', alignItems: 'center' }}><ArrowUpIcon width={12} /> {data.totalDiff} คน</span> จากปีที่แล้ว</>
            ) : (
              <><span style={{ color: '#ef4444', display: 'flex', alignItems: 'center' }}><ArrowDownIcon width={12} /> {Math.abs(data?.totalDiff || 0)} คน</span> จากปีที่แล้ว</>
            )}
          </div>
        </div>
        
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <div className={styles.kpiIconWrapper} style={{ background: '#f0fdf4', color: '#16a34a' }}>
              <UserGroupIcon width={24} />
            </div>
            <div className={styles.kpiTitle}>พนักงานประจำ</div>
          </div>
          <div className={styles.kpiValue}>{data?.permanent ?? 0} <span style={{fontSize: 14, fontWeight: 600, color: '#64748b'}}>คน</span></div>
          <div className={styles.kpiSub}>{data?.total ? ((data.permanent / data.total) * 100).toFixed(2) : 0}% ของทั้งหมด</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <div className={styles.kpiIconWrapper} style={{ background: '#fff7ed', color: '#f97316' }}>
              <UserIcon width={24} />
            </div>
            <div className={styles.kpiTitle}>พนักงานชั่วคราว / ทดลองงาน</div>
          </div>
          <div className={styles.kpiValue}>{data?.temporary ?? 0} <span style={{fontSize: 14, fontWeight: 600, color: '#64748b'}}>คน</span></div>
          <div className={styles.kpiSub}>{data?.total ? ((data.temporary / data.total) * 100).toFixed(2) : 0}% ของทั้งหมด</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <div className={styles.kpiIconWrapper} style={{ background: '#faf5ff', color: '#a855f7' }}>
              <UserPlusIcon width={24} />
            </div>
            <div className={styles.kpiTitle}>พนักงานเข้าใหม่ (ปีนี้)</div>
          </div>
          <div className={styles.kpiValue}>{data?.newHires ?? 0} <span style={{fontSize: 14, fontWeight: 600, color: '#64748b'}}>คน</span></div>
          <div className={styles.kpiSub}>
            {data && data.newHiresDiff >= 0 ? (
              <><span style={{ color: '#16a34a', display: 'flex', alignItems: 'center' }}><ArrowUpIcon width={12} /> {data.newHiresDiff} คน</span> จากปีก่อน</>
            ) : (
              <><span style={{ color: '#ef4444', display: 'flex', alignItems: 'center' }}><ArrowDownIcon width={12} /> {Math.abs(data?.newHiresDiff || 0)} คน</span> จากปีก่อน</>
            )}
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <div className={styles.kpiIconWrapper} style={{ background: '#fef2f2', color: '#ef4444' }}>
              <ArrowRightStartOnRectangleIcon width={24} />
            </div>
            <div className={styles.kpiTitle}>พนักงานลาออก (ปีนี้)</div>
          </div>
          <div className={styles.kpiValue}>{data?.resigned ?? 0} <span style={{fontSize: 14, fontWeight: 600, color: '#64748b'}}>คน</span></div>
          <div className={styles.kpiSub}>
            {data && data.resignedDiff >= 0 ? (
              <><span style={{ color: '#ef4444', display: 'flex', alignItems: 'center' }}><ArrowUpIcon width={12} /> {data.resignedDiff} คน</span> จากปีก่อน</>
            ) : (
              <><span style={{ color: '#16a34a', display: 'flex', alignItems: 'center' }}><ArrowDownIcon width={12} /> {Math.abs(data?.resignedDiff || 0)} คน</span> จากปีก่อน</>
            )}
          </div>
        </div>
      </div>

      {/* 2. First Row of Charts */}
      <div className={styles.chartRow}>
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>จำนวนพนักงาน แยกตามแผนก</div>
          <div className={styles.chartArea}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={deptChartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={130} tick={{fontSize: 12}} />
                <RechartsTooltip cursor={{fill: '#f1f5f9'}} />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>สัดส่วนพนักงาน แยกตามเพศ</div>
          <div className={styles.chartArea}>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={genderChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} fill="#8884d8" paddingAngle={2} dataKey="value" labelLine={false} label={false}>
                  {genderChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={GENDER_COLORS[index % GENDER_COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(value: any, name: any) => [`${value} คน`, name]} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>ช่วงอายุของพนักงาน</div>
          <div className={styles.chartArea}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={ageChartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={12} interval={0} tick={{width: 70}} />
                <YAxis fontSize={12} />
                <RechartsTooltip cursor={{fill: '#f1f5f9'}} />
                <Bar dataKey="value" fill="#0ea5e9" radius={[4, 4, 0, 0]} barSize={30} label={{ position: 'top', fontSize: 12, fill: '#334155', fontWeight: 600 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 3. Second Row of Charts */}
      <div className={styles.chartRow} style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>อัตราการลาออกของพนักงาน (Turnover Rate)</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', marginBottom: 16 }}>
            {turnoverChartData.length > 0 ? (turnoverChartData.reduce((sum, d) => sum + d.rate, 0) / turnoverChartData.length).toFixed(2) : '0.00'}%
            <span style={{fontSize: 12, fontWeight: 500, color: '#64748b', marginLeft: 8}}>เฉลี่ยรายเดือน (เป้าหมายไม่เกิน 8%)</span>
          </div>
          <div className={styles.chartArea} style={{ height: 195 }}>
            <ResponsiveContainer width="100%" height={195}>
              <LineChart data={turnoverChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} domain={[0, 10]} />
                <RechartsTooltip formatter={(value: any, name: any) => {
                  if (name === 'rate') return [`${value}%`, 'Turnover Rate'];
                  return [value, name];
                }} />
                <Line type="monotone" dataKey="rate" stroke="#3b82f6" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>พนักงานเข้าใหม่ &amp; ลาออก รายเดือน</div>
          <div className={styles.chartArea}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={newResignedChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} />
                <RechartsTooltip cursor={{fill: '#f1f5f9'}} />
                <Legend verticalAlign="top" height={36} iconType="circle" />
                <Bar dataKey="เข้าใหม่" fill="#10b981" radius={[4, 4, 0, 0]} barSize={10} />
                <Bar dataKey="ลาออก" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={10} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 3.5 Leave Section - Full Width */}
      <div className={styles.chartCard}>
        <div className={styles.chartTitle} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span>สรุปการลา แยกตามประเภท (ปีนี้)</span>
          <div style={{ display: 'flex', gap: 6, fontSize: 12 }}>
            <span style={{ background: '#f1f5f9', padding: '4px 10px', borderRadius: 6, color: '#64748b', fontWeight: 600 }}>
              รวม {leaveChartData.totalDays || 0} วัน
            </span>
            <span style={{ background: '#eff6ff', padding: '4px 10px', borderRadius: 6, color: '#3b82f6', fontWeight: 600 }}>
              {leaveChartData.totalRequests || 0} ครั้ง
            </span>
          </div>
        </div>

        {/* Two-column layout: summary bars + monthly chart */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Left: Leave type summary bars */}
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 14 }}>สัดส่วนการลาแต่ละประเภท</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(leaveChartData.summary || []).map((item: any, idx: number) => (
                <div key={item.type} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: LEAVE_COLORS[leaveChartData.types.indexOf(item.type) % LEAVE_COLORS.length], flexShrink: 0 }} />
                  <div style={{ minWidth: 110, fontSize: 13, fontWeight: 500, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.type}</div>
                  <div style={{ flex: 1, height: 20, background: '#f1f5f9', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.max(4, item.percentage)}%`,
                      background: LEAVE_COLORS[leaveChartData.types.indexOf(item.type) % LEAVE_COLORS.length],
                      borderRadius: 6,
                      opacity: 0.75,
                      transition: 'width 0.6s ease'
                    }} />
                  </div>
                  <div style={{ minWidth: 55, textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                    {item.totalDays} <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: 11 }}>วัน</span>
                  </div>
                  <div style={{ minWidth: 50, textAlign: 'right', fontSize: 12, color: '#64748b' }}>
                    {item.count} ครั้ง
                  </div>
                  <div style={{ minWidth: 40, textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>
                    {item.percentage}%
                  </div>
                </div>
              ))}
              {(!leaveChartData.summary || leaveChartData.summary.length === 0) && (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: 20, fontSize: 13 }}>ไม่มีข้อมูลการลา</div>
              )}
            </div>
          </div>

          {/* Right: Monthly chart with tabs */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>แนวโน้มรายเดือน</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setSelectedLeaveType('all')}
                  style={{
                    fontSize: 11, padding: '3px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600,
                    background: selectedLeaveType === 'all' ? '#3b82f6' : '#f1f5f9',
                    color: selectedLeaveType === 'all' ? '#fff' : '#64748b',
                    transition: 'all 0.2s'
                  }}
                >
                  ทั้งหมด
                </button>
                {leaveChartData.types.map((type: string, idx: number) => (
                  <button
                    key={type}
                    onClick={() => setSelectedLeaveType(type)}
                    style={{
                      fontSize: 11, padding: '3px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600,
                      background: selectedLeaveType === type ? LEAVE_COLORS[idx % LEAVE_COLORS.length] : '#f1f5f9',
                      color: selectedLeaveType === type ? '#fff' : '#64748b',
                      transition: 'all 0.2s'
                    }}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={leaveChartData.data} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} />
                <RechartsTooltip cursor={{fill: '#f1f5f9'}} formatter={(value: any, name: any) => [`${value} วัน`, name]} />
                {selectedLeaveType === 'all' ? (
                  leaveChartData.types.map((type: string, index: number) => (
                    <Bar key={type} dataKey={type} stackId="a" fill={LEAVE_COLORS[index % LEAVE_COLORS.length]} barSize={28} radius={index === leaveChartData.types.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                  ))
                ) : (
                  <Bar dataKey={selectedLeaveType} fill={LEAVE_COLORS[leaveChartData.types.indexOf(selectedLeaveType) % LEAVE_COLORS.length]} radius={[4, 4, 0, 0]} barSize={28} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>


      {/* 4. Third Row (Tables & Gauges) */}
      <div className={styles.chartRow}>
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>พนักงานที่กำลังจะครบสัญญา</div>
          <div className={styles.tableContainer}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>ชื่อ-สกุล</th>
                  <th>ตำแหน่ง</th>
                  <th>แผนก</th>
                  <th>ครบสัญญา</th>
                </tr>
              </thead>
              <tbody>
                {expiringContractsData.map((emp, i) => (
                  <tr key={i}>
                    <td style={{fontWeight: 500}}>{emp.name}</td>
                    <td>{emp.role}</td>
                    <td>{emp.dept}</td>
                    <td style={{color: '#ef4444', fontWeight: 600}}>{emp.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>การอบรมพัฒนาบุคลากร</div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 0' }}>
            {/* Gauge */}
            <div style={{ position: 'relative', width: 200, height: 110, marginBottom: 8 }}>
              <svg viewBox="0 0 200 110" width="200" height="110">
                {/* Background arc */}
                <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#e2e8f0" strokeWidth="22" strokeLinecap="round" />
                {/* Filled arc — calculate stroke-dasharray */}
                <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke={trainingData.percentage >= 80 ? '#10b981' : trainingData.percentage >= 50 ? '#3b82f6' : '#f59e0b'} strokeWidth="22" strokeLinecap="round"
                  strokeDasharray={`${(trainingData.percentage / 100) * 251.3} 251.3`} />
              </svg>
              <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#1e293b' }}>{trainingData.percentage}%</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>พนักงานที่ผ่านการอบรม</div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: '#334155', fontWeight: 600 }}>
              {trainingData.trainedEmployees} / {trainingData.totalEmployees} คน
              <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: 8 }}>(เป้าหมาย 80%)</span>
            </div>

            {/* Recent trainings table */}
            {trainingData.recentTrainings.length > 0 && (
              <div style={{ width: '100%', marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8, paddingLeft: 4 }}>การอบรมล่าสุด</div>
                <table className={styles.dataTable} style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>พนักงาน</th>
                      <th>หลักสูตร</th>
                      <th>วันที่</th>
                      <th>สำเร็จ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trainingData.recentTrainings.map((t: any, idx: number) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 500 }}>{t.name}</td>
                        <td>{t.course}</td>
                        <td>{t.date}</td>
                        <td style={{ fontWeight: 600, color: t.completion != null && t.completion >= 80 ? '#10b981' : '#f59e0b' }}>
                          {t.completion != null ? `${t.completion}%` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>ผลการประเมินผลงานประจำปี</div>
          <div className={styles.tableContainer}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>ระดับผลประเมิน</th>
                  <th>จำนวน (คน)</th>
                  <th>สัดส่วน</th>
                </tr>
              </thead>
              <tbody>
                {performancesData.map((p, idx) => (
                  <tr key={idx}>
                    <td><span className={`${styles.badge} ${styles[p.badge]}`}>{p.grade}</span></td>
                    <td style={{fontWeight: 600}}>{p.count}</td>
                    <td>{p.pct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
    </div>
  );
}
