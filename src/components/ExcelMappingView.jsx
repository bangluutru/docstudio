import React, { useState, useEffect, useCallback } from 'react';
import {
    FileSpreadsheet, Upload, Download, Sparkles, Plus,
    Trash2, ChevronDown, ChevronUp, AlertCircle, Save
} from 'lucide-react';
import { readExcelFile, autoMapFields, exportMappedExcel } from '../utils/excel';
import ZoneEditor from './ZoneEditor';

export default function ExcelMappingView({ t: tProp, displayLang }) {
    const t = tProp || {};

    // --- STATE ---
    // Source (Customer)
    const [sourceFile, setSourceFile] = useState(null);
    const [sourceHeaders, setSourceHeaders] = useState([]);
    const [sourceData, setSourceData] = useState([]);
    const [sourceAllData, setSourceAllData] = useState([]);

    // Target (Supplier) - 3 Zones
    const [targetFile, setTargetFile] = useState(null);
    const [targetHeaders, setTargetHeaders] = useState([]);
    const [targetBuffer, setTargetBuffer] = useState(null);
    const [headerRowIndex, setHeaderRowIndex] = useState(null);
    const [headerZone, setHeaderZone] = useState([]);       // Zone 1
    const [footerZone, setFooterZone] = useState([]);       // Zone 3
    const [footerStartRow, setFooterStartRow] = useState(null);
    const [existingDataSlots, setExistingDataSlots] = useState(0);
    const [colCount, setColCount] = useState(0);

    // Mapping & Profiles
    const [mappingRules, setMappingRules] = useState([]);
    const [profiles, setProfiles] = useState({});
    const [currentProfileName, setCurrentProfileName] = useState('New Profile');
    const [showBottomPanel, setShowBottomPanel] = useState(true);

    // Status
    const [error, setError] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    // Load profiles from local storage
    useEffect(() => {
        const saved = localStorage.getItem('docstudio_mapping_profiles');
        if (saved) {
            try { setProfiles(JSON.parse(saved)); } catch (e) { }
        }
    }, []);

    // --- ACTIONS ---
    const handleFileUpload = async (event, isSource) => {
        const file = event.target.files[0];
        if (!file) return;
        setIsProcessing(true);
        setError('');

        try {
            const result = await readExcelFile(file, isSource);
            if (isSource) {
                setSourceFile(file.name);
                setSourceHeaders(result.headers);
                setSourceData(result.sampleRows);
                setSourceAllData(result.allRows);
            } else {
                setTargetFile(file.name);
                setTargetHeaders(result.headers);
                setTargetBuffer(result.rawBuffer);
                setHeaderRowIndex(result.headerRowIndex);
                // Store 3-Zone data
                setHeaderZone(result.headerZone || []);
                setFooterZone(result.footerZone || []);
                setFooterStartRow(result.footerStartRow);
                setExistingDataSlots(result.existingDataSlots || 0);
                setColCount(result.colCount || 0);
            }

            // Auto-map
            if (isSource && targetHeaders.length > 0 && mappingRules.length === 0) {
                setMappingRules(autoMapFields(result.headers, targetHeaders));
            } else if (!isSource && sourceHeaders.length > 0 && mappingRules.length === 0) {
                setMappingRules(autoMapFields(sourceHeaders, result.headers));
            }
        } catch (err) {
            setError(`Error reading file: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAutoMap = () => {
        if (sourceHeaders.length === 0 || targetHeaders.length === 0) {
            setError("Please upload both source and target files first.");
            return;
        }
        setMappingRules(autoMapFields(sourceHeaders, targetHeaders));
        setError('');
    };

    const handleExport = async () => {
        if (sourceAllData.length === 0 || targetHeaders.length === 0) {
            setError("Cannot export: missing data or template.");
            return;
        }
        if (mappingRules.length === 0) {
            setError("Cannot export: no mapping rules defined.");
            return;
        }

        setIsProcessing(true);
        setError('');

        try {
            await exportMappedExcel({
                sourceAllRows: sourceAllData,
                mappingRules,
                targetBuffer,
                headerRowIndex,
                headerZone,
                footerZone,
                footerStartRow,
                existingDataSlots,
                fileName: `Mapped_${sourceFile || 'Order'}`
            });
        } catch (err) {
            setError(`Export failed: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    // --- Zone editing ---
    const handleHeaderZoneChange = useCallback((rowIdx, colIdx, newValue) => {
        setHeaderZone(prev => prev.map((row, ri) => {
            if (ri !== rowIdx) return row;
            return {
                ...row,
                cells: row.cells.map((cell, ci) => {
                    if (ci !== colIdx) return cell;
                    return { ...cell, value: newValue };
                })
            };
        }));
    }, []);

    const handleFooterZoneChange = useCallback((rowIdx, colIdx, newValue) => {
        setFooterZone(prev => prev.map((row, ri) => {
            if (ri !== rowIdx) return row;
            return {
                ...row,
                cells: row.cells.map((cell, ci) => {
                    if (ci !== colIdx) return cell;
                    return { ...cell, value: newValue };
                })
            };
        }));
    }, []);

    // --- Profile management ---
    const saveProfile = () => {
        if (mappingRules.length === 0) return;
        const name = window.prompt("Enter profile name:", currentProfileName === 'New Profile' ? '' : currentProfileName);
        if (!name) return;
        const newProfiles = { ...profiles, [name]: mappingRules };
        setProfiles(newProfiles);
        setCurrentProfileName(name);
        localStorage.setItem('docstudio_mapping_profiles', JSON.stringify(newProfiles));
    };

    const loadProfile = (name) => {
        if (profiles[name]) {
            setMappingRules(profiles[name]);
            setCurrentProfileName(name);
        }
    };

    const removeRule = (index) => {
        const newRules = [...mappingRules];
        newRules.splice(index, 1);
        setMappingRules(newRules);
    };

    const addEmptyRule = () => {
        setMappingRules([...mappingRules, { sourceCol: '', targetCol: '', type: 'manual' }]);
        setShowBottomPanel(true);
    };

    const updateRule = (index, field, value) => {
        const newRules = [...mappingRules];
        newRules[index][field] = value;
        if (field === 'sourceCol' || field === 'targetCol') newRules[index].type = 'manual';
        setMappingRules(newRules);
    };

    // --- Helpers ---
    const getSourceStatus = (header) => {
        const rule = mappingRules.find(r => r.sourceCol === header);
        if (!rule) return 'unmapped';
        return rule.type === 'auto' ? 'auto' : 'manual';
    };

    const getTargetValue = (rowIndex, targetHeader) => {
        const rule = mappingRules.find(r => r.targetCol === targetHeader);
        if (!rule || !rule.sourceCol) return '';
        return sourceData[rowIndex]?.[rule.sourceCol] || '';
    };

    const statusColors = {
        auto: 'bg-green-500', manual: 'bg-amber-500', unmapped: 'bg-red-500'
    };
    const bgColors = {
        auto: 'bg-green-100 text-green-800 border-green-200',
        manual: 'bg-amber-100 text-amber-800 border-amber-200',
        unmapped: 'bg-red-50 border-red-200 text-red-600 border-dashed'
    };

    // --- UI RENDER ---
    return (
        <div className="flex flex-col h-screen w-full bg-slate-50 font-sans overflow-hidden">

            {/* 1. TOP BAR */}
            <header className="h-14 shrink-0 bg-gradient-to-r from-indigo-700 to-purple-700 text-white flex items-center justify-between px-6 shadow-md z-10">
                <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-5 h-5 text-indigo-200" />
                    <h1 className="font-semibold text-lg tracking-tight">DocStudio <span className="text-indigo-300 font-normal">· {t.tabExcelMapping || 'Excel Order Mapping'}</span></h1>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-sm flex items-center gap-2">
                        <span className="text-indigo-200">Profile:</span>
                        <select
                            className="bg-indigo-800/50 border border-indigo-600 rounded px-2 py-1 text-sm outline-none"
                            value={currentProfileName}
                            onChange={(e) => {
                                if (e.target.value !== 'New Profile') loadProfile(e.target.value);
                                else { setCurrentProfileName('New Profile'); setMappingRules([]); }
                            }}
                        >
                            <option value="New Profile">-- {t.mappingNew || 'New Profile'} --</option>
                            {Object.keys(profiles).map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={handleExport}
                        disabled={!sourceFile || !targetFile || mappingRules.length === 0 || isProcessing}
                        className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-1.5 rounded font-medium text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Download className="w-4 h-4" />
                        {isProcessing ? 'Processing...' : (t.exportXlsx || 'Tải xuống .xlsx')}
                    </button>
                </div>
            </header>

            {error && (
                <div className="bg-red-50 text-red-600 p-2 text-center text-sm font-medium border-b border-red-100 flex items-center justify-center gap-2 shrink-0">
                    <AlertCircle className="w-4 h-4" /> {error}
                </div>
            )}

            {/* 2. MAIN AREA (Split View) */}
            <main className="flex-1 flex overflow-hidden relative">

                {/* LEFT COLUMN: SOURCE */}
                <section className="flex-1 flex flex-col p-4 overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
                        <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                            <h2 className="font-bold text-slate-700 text-sm">{t.sourceCustomer || 'Nguồn: Đơn hàng Khách'}</h2>
                            <label className="cursor-pointer">
                                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => handleFileUpload(e, true)} />
                                <div className={`px-3 py-1.5 rounded text-xs font-medium border border-dashed transition-colors flex items-center gap-2 ${sourceFile ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'hover:bg-slate-100 border-slate-300 text-slate-600'}`}>
                                    <Upload className="w-3.5 h-3.5" />
                                    {sourceFile ? `${sourceFile} ✓` : 'Upload File'}
                                </div>
                            </label>
                        </div>

                        <div className="flex-1 overflow-auto p-3">
                            {sourceHeaders.length > 0 ? (
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead className="bg-slate-50/80 sticky top-0 z-10 shadow-sm backdrop-blur">
                                        <tr>
                                            {sourceHeaders.map((header, i) => (
                                                <th key={i} className="py-2 px-2 border-b border-slate-200 font-semibold text-slate-700 whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5">
                                                        {header}
                                                        <div className={`w-2 h-2 rounded-full ${statusColors[getSourceStatus(header)]}`} />
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sourceData.map((row, rowIdx) => (
                                            <tr key={rowIdx} className="hover:bg-slate-50 border-b border-slate-100">
                                                {sourceHeaders.map((header, colIdx) => (
                                                    <td key={colIdx} className={`py-1.5 px-2 truncate max-w-[130px] border-l-2 ${getSourceStatus(header) === 'auto' ? 'border-green-400' : getSourceStatus(header) === 'manual' ? 'border-amber-400' : 'border-transparent'}`}>
                                                        {row[header] !== undefined ? String(row[header]) : ''}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="h-full flex items-center justify-center text-slate-400 text-sm">Upload đơn hàng để xem preview</div>
                            )}
                        </div>
                    </div>
                </section>

                {/* CENTER SMART DIVIDER */}
                <div className="w-20 shrink-0 flex flex-col items-center justify-center z-10">
                    <div className="flex-1 w-px bg-slate-200 my-4" />
                    <button
                        onClick={handleAutoMap}
                        disabled={!sourceFile || !targetFile || isProcessing}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-full p-3 shadow-lg transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed group"
                        title={t.autoMapBtn || 'AI Auto-Map'}
                    >
                        <Sparkles className="w-5 h-5 animate-pulse group-hover:animate-none" />
                    </button>
                    <div className="text-[10px] font-bold tracking-wider text-indigo-400 mt-2 uppercase">Auto-map</div>
                    <div className="flex-1 w-px bg-slate-200 my-4" />
                </div>

                {/* RIGHT COLUMN: TARGET with 3-Zone Layout */}
                <section className="flex-1 flex flex-col p-4 overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
                        <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                            <h2 className="font-bold text-slate-700 text-sm">{t.targetSupplier || 'Đích: Mẫu Nhà cung cấp'}</h2>
                            <label className="cursor-pointer">
                                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => handleFileUpload(e, false)} />
                                <div className={`px-3 py-1.5 rounded text-xs font-medium border border-dashed transition-colors flex items-center gap-2 ${targetFile ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'hover:bg-slate-100 border-slate-300 text-slate-600'}`}>
                                    <Upload className="w-3.5 h-3.5" />
                                    {targetFile ? `${targetFile} ✓` : 'Upload Template'}
                                </div>
                            </label>
                        </div>

                        <div className="flex-1 overflow-auto p-3">
                            {targetHeaders.length > 0 ? (
                                <div className="space-y-2">
                                    {/* ZONE 1: Editable Header */}
                                    <ZoneEditor
                                        zone={headerZone}
                                        onCellChange={handleHeaderZoneChange}
                                        title="Thông tin đầu mẫu (Header)"
                                        icon={<ChevronUp className="w-3 h-3 text-blue-500" />}
                                    />

                                    {/* ZONE 2: Product Data Table */}
                                    <div className="bg-white rounded-lg border border-green-200">
                                        <div className="px-3 py-2 bg-green-50 border-b border-green-200 rounded-t-lg">
                                            <span className="text-xs font-bold text-green-700 uppercase tracking-wider">
                                                📦 Bảng sản phẩm ({sourceData.length} sản phẩm)
                                            </span>
                                        </div>
                                        <table className="w-full text-xs text-left border-collapse">
                                            <thead className="bg-slate-50">
                                                <tr>
                                                    {targetHeaders.map((header, i) => (
                                                        <th key={i} className="py-1.5 px-2 border-b border-slate-200 font-semibold text-slate-700 whitespace-nowrap">
                                                            {header}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sourceData.length > 0 ? sourceData.map((_, rowIdx) => (
                                                    <tr key={rowIdx} className="border-b border-slate-100">
                                                        {targetHeaders.map((header, colIdx) => {
                                                            const val = getTargetValue(rowIdx, header);
                                                            const isMapped = val !== '';
                                                            return (
                                                                <td key={colIdx} className="py-1 px-2 truncate max-w-[120px]">
                                                                    <div className={`px-1.5 py-0.5 rounded text-xs min-h-[22px] ${isMapped ? 'bg-green-50 text-green-900 border border-green-100' : 'bg-slate-50 text-slate-400 border border-dashed border-slate-200'}`}>
                                                                        {val || '—'}
                                                                    </div>
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                )) : (
                                                    <tr>
                                                        <td colSpan={targetHeaders.length} className="py-3 text-center text-slate-400 italic text-xs">
                                                            Upload đơn khách để xem sản phẩm
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* ZONE 3: Editable Footer */}
                                    <ZoneEditor
                                        zone={footerZone}
                                        onCellChange={handleFooterZoneChange}
                                        title="Thông tin cuối mẫu (Footer)"
                                        icon={<ChevronDown className="w-3 h-3 text-orange-500" />}
                                    />
                                </div>
                            ) : (
                                <div className="h-full flex items-center justify-center text-slate-400 text-sm">Upload mẫu NCC để xem 3 vùng</div>
                            )}
                        </div>
                    </div>
                </section>

            </main>

            {/* 3. BOTTOM PANEL: MAPPING RULES */}
            <footer className={`bg-white/80 backdrop-blur border-t border-slate-200 transition-all duration-300 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] z-20 ${showBottomPanel ? 'h-44' : 'h-11'}`}>

                <div className="h-11 px-6 flex items-center justify-between border-b border-slate-100">
                    <button
                        onClick={() => setShowBottomPanel(!showBottomPanel)}
                        className="flex items-center gap-2 font-bold text-slate-700 hover:text-indigo-600 focus:outline-none text-sm"
                    >
                        {t.fieldMappingRules || 'Quy tắc khớp trường (Rules)'}
                        <div className="bg-slate-100 p-1 rounded-full text-slate-500">
                            {showBottomPanel ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                        </div>
                    </button>

                    <div className="flex gap-3">
                        <button onClick={addEmptyRule} className="text-xs font-medium text-slate-600 hover:text-indigo-600 flex items-center gap-1 border border-slate-200 bg-white px-3 py-1 rounded shadow-sm hover:border-indigo-200">
                            <Plus size={12} /> {t.addRule || '+ Thêm Rule'}
                        </button>
                        <button onClick={saveProfile} className="text-xs font-medium text-white hover:bg-slate-700 flex items-center gap-1 border border-slate-800 bg-slate-800 px-3 py-1 rounded shadow-sm">
                            <Save size={12} /> {t.saveProfile || 'Lưu Profile'}
                        </button>
                    </div>
                </div>

                {showBottomPanel && (
                    <div className="p-3 h-[132px] overflow-y-auto">
                        {mappingRules.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-slate-400 text-xs">Chưa có quy tắc. Bấm "Auto-Map" hoặc "+ Thêm Rule".</div>
                        ) : (
                            <div className="flex flex-wrap gap-2 items-start">
                                {mappingRules.map((rule, idx) => (
                                    <div key={idx} className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-lg border shadow-sm transition-all focus-within:ring-2 focus-within:ring-indigo-200 ${bgColors[rule.type] || bgColors.manual}`}>

                                        <select
                                            className="bg-transparent border-none outline-none text-xs font-medium appearance-none cursor-pointer text-inherit max-w-[110px] truncate"
                                            value={rule.sourceCol}
                                            onChange={(e) => updateRule(idx, 'sourceCol', e.target.value)}
                                        >
                                            <option value="">-- Source --</option>
                                            {sourceHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>

                                        <span className="text-inherit opacity-60 text-xs">→</span>

                                        <select
                                            className="bg-transparent border-none outline-none text-xs font-medium appearance-none cursor-pointer text-inherit max-w-[110px] truncate"
                                            value={rule.targetCol}
                                            onChange={(e) => updateRule(idx, 'targetCol', e.target.value)}
                                        >
                                            <option value="">-- Target --</option>
                                            {targetHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>

                                        <button
                                            onClick={() => removeRule(idx)}
                                            className="opacity-0 group-hover:opacity-100 ml-1 text-red-400 hover:text-red-700 hover:bg-white rounded p-0.5 transition-all"
                                        >
                                            <Trash2 size={11} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </footer>

        </div>
    );
}
