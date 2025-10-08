import {useState,useEffect} from 'react';
import {motion,AnimatePresence} from 'framer-motion';
import {RiCloseLine,RiDownloadLine,RiFileTextLine,RiFileExcelLine,RiCalendarLine,RiMoneyDollarCircleLine,RiCalculatorLine,RiCheckLine,RiAlertLine,RiInformationLine} from 'react-icons/ri';
import * as XLSX from 'xlsx';
import {getInventoryItems} from '../services/db';
import {useAuth} from '../context/AuthContext';

export default function TaxExportModal({isOpen,onClose,onExportComplete}) {
  const [isLoading,setIsLoading]=useState(false);
  const [inventoryData,setInventoryData]=useState([]);
  const [exportSettings,setExportSettings]=useState({
    format: 'excel',
    dateRange: 'all',
    startDate: new Date(new Date().getFullYear(),0,1).toISOString().split('T')[0], // Start of current year
    endDate: new Date().toISOString().split('T')[0], // Today
    includeZeroValue: true,
    includeOutOfStock: true,
    groupByCategory: false,
    includeTaxCalculations: true,
    vatRate: 20, // UK VAT rate
    currencyFormat: 'GBP',
    reportType: 'full'
  });
  const [taxSummary,setTaxSummary]=useState(null);
  const [error,setError]=useState('');
  const {user}=useAuth();

  useEffect(()=> {
    if (isOpen && user?.email) {
      loadInventoryData();
    }
  },[isOpen,user?.email]);

  const loadInventoryData=async ()=> {
    try {
      setIsLoading(true);
      const items=await getInventoryItems(user.email);
      setInventoryData(items);
      calculateTaxSummary(items);
    } catch (error) {
      console.error('Error loading inventory data:',error);
      setError('Failed to load inventory data');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateTaxSummary=(items)=> {
    const filteredItems=filterItemsByDateRange(items);
    
    const totalValue=filteredItems.reduce((sum,item)=> 
      sum + (item.quantity * item.unitPrice),0
    );
    
    const vatAmount=exportSettings.includeTaxCalculations ? 
      totalValue * (exportSettings.vatRate / 100) : 0;
    
    const totalWithVAT=totalValue + vatAmount;
    
    const categoryBreakdown=filteredItems.reduce((acc,item)=> {
      const category=item.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category]={
          items: 0,
          quantity: 0,
          value: 0
        };
      }
      acc[category].items++;
      acc[category].quantity +=item.quantity;
      acc[category].value +=item.quantity * item.unitPrice;
      return acc;
    },{});

    setTaxSummary({
      totalItems: filteredItems.length,
      totalQuantity: filteredItems.reduce((sum,item)=> sum + item.quantity,0),
      totalValue,
      vatAmount,
      totalWithVAT,
      categoryBreakdown,
      averageItemValue: filteredItems.length > 0 ? totalValue / filteredItems.length : 0,
      stockTurnover: calculateStockTurnover(filteredItems),
      dateRange: {
        start: exportSettings.startDate,
        end: exportSettings.endDate
      }
    });
  };

  const calculateStockTurnover=(items)=> {
    // Simplified stock turnover calculation
    const totalCost=items.reduce((sum,item)=> sum + (item.quantity * item.unitPrice),0);
    const averageInventory=totalCost / (items.length || 1);
    return averageInventory > 0 ? totalCost / averageInventory : 0;
  };

  const filterItemsByDateRange=(items)=> {
    let filtered=items;

    // Filter by date range
    if (exportSettings.dateRange !== 'all') {
      const startDate=new Date(exportSettings.startDate);
      const endDate=new Date(exportSettings.endDate);
      
      filtered=filtered.filter(item=> {
        const itemDate=new Date(item.dateAdded || item.createdAt);
        return itemDate >= startDate && itemDate <= endDate;
      });
    }

    // Filter zero value items
    if (!exportSettings.includeZeroValue) {
      filtered=filtered.filter(item=> (item.quantity * item.unitPrice) > 0);
    }

    // Filter out of stock items
    if (!exportSettings.includeOutOfStock) {
      filtered=filtered.filter(item=> item.status !== 'Out of Stock');
    }

    return filtered;
  };

  const generateExcelReport=()=> {
    const filteredItems=filterItemsByDateRange(inventoryData);
    
    // Prepare data based on report type
    let reportData=[];
    
    if (exportSettings.reportType === 'summary') {
      // Summary report by category
      const categoryData=Object.entries(taxSummary.categoryBreakdown).map(([category,data])=> ({
        'Category': category,
        'Total Items': data.items,
        'Total Quantity': data.quantity,
        'Total Value (Excl. VAT)': data.value,
        'VAT Amount': exportSettings.includeTaxCalculations ? data.value * (exportSettings.vatRate / 100) : 0,
        'Total Value (Incl. VAT)': exportSettings.includeTaxCalculations ? 
          data.value * (1 + exportSettings.vatRate / 100) : data.value,
        'Average Item Value': data.items > 0 ? data.value / data.items : 0
      }));
      
      reportData=categoryData;
    } else {
      // Full detailed report
      reportData=filteredItems.map(item=> {
        const itemTotal=item.quantity * item.unitPrice;
        const itemVAT=exportSettings.includeTaxCalculations ? 
          itemTotal * (exportSettings.vatRate / 100) : 0;
        
        return {
          'Item Name': item.name,
          'Category': item.category || 'Uncategorized',
          'Quantity': item.quantity,
          'Unit Price (Excl. VAT)': item.unitPrice,
          'Total Value (Excl. VAT)': itemTotal,
          'VAT Amount': itemVAT,
          'Total Value (Incl. VAT)': itemTotal + itemVAT,
          'Status': item.status,
          'Date Added': item.dateAdded,
          'Description': item.description || '',
          'SKU/Reference': item.id || '',
          'Last Updated': item.updatedAt || item.createdAt || ''
        };
      });
    }

    // Create workbook
    const wb=XLSX.utils.book_new();
    
    // Main data sheet
    const ws=XLSX.utils.json_to_sheet(reportData);
    XLSX.utils.book_append_sheet(wb,ws,exportSettings.reportType === 'summary' ? 'Category Summary' : 'Inventory Details');

    // Tax summary sheet
    const taxSummaryData=[
      ['TAX SUMMARY REPORT',''],
      ['Generated on:',new Date().toLocaleDateString('en-GB')],
      ['Business Name:',user?.businessName || ''],
      ['Export Period:',exportSettings.dateRange === 'all' ? 'All Time' : `${exportSettings.startDate} to ${exportSettings.endDate}`],
      ['',''],
      ['FINANCIAL SUMMARY',''],
      ['Total Items:',taxSummary.totalItems],
      ['Total Quantity:',taxSummary.totalQuantity],
      ['Total Value (Excl. VAT):',`£${taxSummary.totalValue.toFixed(2)}`],
      ['VAT Rate:',`${exportSettings.vatRate}%`],
      ['VAT Amount:',`£${taxSummary.vatAmount.toFixed(2)}`],
      ['Total Value (Incl. VAT):',`£${taxSummary.totalWithVAT.toFixed(2)}`],
      ['Average Item Value:',`£${taxSummary.averageItemValue.toFixed(2)}`],
      ['',''],
      ['CATEGORY BREAKDOWN','']
    ];

    // Add category breakdown
    Object.entries(taxSummary.categoryBreakdown).forEach(([category,data])=> {
      taxSummaryData.push([
        category,
        `${data.items} items`,
        `Qty: ${data.quantity}`,
        `£${data.value.toFixed(2)}`
      ]);
    });

    const taxWs=XLSX.utils.aoa_to_sheet(taxSummaryData);
    XLSX.utils.book_append_sheet(wb,taxWs,'Tax Summary');

    // Accountant notes sheet
    const notesData=[
      ['ACCOUNTANT NOTES & INFORMATION',''],
      ['',''],
      ['REPORT DETAILS',''],
      ['Report Generated:',new Date().toLocaleString('en-GB')],
      ['Generated By:',user?.businessName || ''],
      ['Email:',user?.email || ''],
      ['System:','Trackio Inventory Management'],
      ['',''],
      ['ACCOUNTING INFORMATION',''],
      ['Currency:','British Pounds (GBP)'],
      ['VAT Registration:','Please verify with business'],
      ['Accounting Period:',exportSettings.dateRange === 'all' ? 'All Time' : `${exportSettings.startDate} to ${exportSettings.endDate}`],
      ['Inventory Valuation Method:','FIFO (First In, First Out)'],
      ['',''],
      ['IMPORTANT NOTES FOR ACCOUNTANT',''],
      ['1. Inventory Valuation:','All values represent current stock on hand'],
      ['2. VAT Calculations:',`Applied at ${exportSettings.vatRate}% (UK standard rate)`],
      ['3. Cost Basis:','Values shown are purchase/cost prices'],
      ['4. Stock Status:','In Stock, Limited Stock, Out of Stock included as specified'],
      ['5. Date Range:',exportSettings.dateRange === 'all' ? 'Complete inventory as of export date' : 'Filtered by date range'],
      ['6. Categories:','Items grouped by business categories'],
      ['7. Verification:','All data extracted from Trackio inventory system'],
      ['',''],
      ['EXPORT SETTINGS USED',''],
      ['Include Zero Value Items:',exportSettings.includeZeroValue ? 'Yes' : 'No'],
      ['Include Out of Stock:',exportSettings.includeOutOfStock ? 'Yes' : 'No'],
      ['Group by Category:',exportSettings.groupByCategory ? 'Yes' : 'No'],
      ['Include VAT Calculations:',exportSettings.includeTaxCalculations ? 'Yes' : 'No'],
      ['Report Type:',exportSettings.reportType === 'summary' ? 'Category Summary' : 'Full Detailed Report'],
      ['',''],
      ['CONTACT INFORMATION',''],
      ['For questions about this export:',user?.email || ''],
      ['System Support:','support@trackio.com'],
      ['Export Format:','Microsoft Excel (.xlsx)']
    ];

    const notesWs=XLSX.utils.aoa_to_sheet(notesData);
    XLSX.utils.book_append_sheet(wb,notesWs,'Accountant Info');

    // Generate filename
    const dateStr=new Date().toISOString().split('T')[0];
    const businessName=(user?.businessName || 'Business').replace(/[^a-zA-Z0-9]/g,'_');
    const fileName=`${businessName}_Tax_Report_${dateStr}.xlsx`;

    // Download file
    XLSX.writeFile(wb,fileName);
    
    return fileName;
  };

  const generateCSVReport=()=> {
    const filteredItems=filterItemsByDateRange(inventoryData);
    
    const csvData=filteredItems.map(item=> {
      const itemTotal=item.quantity * item.unitPrice;
      const itemVAT=exportSettings.includeTaxCalculations ? 
        itemTotal * (exportSettings.vatRate / 100) : 0;
      
      return {
        'Item Name': item.name,
        'Category': item.category || 'Uncategorized',
        'Quantity': item.quantity,
        'Unit Price (Excl VAT)': item.unitPrice,
        'Total Value (Excl VAT)': itemTotal,
        'VAT Amount': itemVAT,
        'Total Value (Incl VAT)': itemTotal + itemVAT,
        'Status': item.status,
        'Date Added': item.dateAdded,
        'Description': item.description || '',
        'SKU': item.id || ''
      };
    });

    // Convert to CSV
    const headers=Object.keys(csvData[0] || {});
    const csvContent=[
      // Header with business info
      `Tax Export Report - ${user?.businessName || 'Business'}`,
      `Generated: ${new Date().toLocaleString('en-GB')}`,
      `Period: ${exportSettings.dateRange === 'all' ? 'All Time' : `${exportSettings.startDate} to ${exportSettings.endDate}`}`,
      `VAT Rate: ${exportSettings.vatRate}%`,
      '',
      // Column headers
      headers.join(','),
      // Data rows
      ...csvData.map(row=> 
        headers.map(header=> {
          const value=row[header];
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    // Download CSV
    const blob=new Blob([csvContent],{type: 'text/csv;charset=utf-8;'});
    const link=document.createElement('a');
    const url=URL.createObjectURL(blob);
    link.setAttribute('href',url);
    
    const dateStr=new Date().toISOString().split('T')[0];
    const businessName=(user?.businessName || 'Business').replace(/[^a-zA-Z0-9]/g,'_');
    const fileName=`${businessName}_Tax_Report_${dateStr}.csv`;
    
    link.setAttribute('download',fileName);
    link.style.visibility='hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    return fileName;
  };

  const generatePDFReport=()=> {
    // Generate HTML content for PDF
    const filteredItems=filterItemsByDateRange(inventoryData);
    
    const htmlContent=`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Tax Export Report - ${user?.businessName || 'Business'}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
          .business-info { background: #f5f5f5; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
          .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
          .summary-card { background: #f9f9f9; padding: 15px; border-left: 4px solid #0ea5e9; }
          .summary-card h3 { margin: 0 0 5px 0; color: #0ea5e9; }
          .summary-card p { margin: 0; font-size: 18px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
          .number { text-align: right; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
          .vat-notice { background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; margin: 20px 0; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Tax Export Report</h1>
          <h2>${user?.businessName || 'Business Name'}</h2>
          <p>Generated on ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB')}</p>
        </div>
        
        <div class="business-info">
          <h3>Business Information</h3>
          <p><strong>Business Name:</strong> ${user?.businessName || 'N/A'}</p>
          <p><strong>Email:</strong> ${user?.email || 'N/A'}</p>
          <p><strong>Report Period:</strong> ${exportSettings.dateRange === 'all' ? 'All Time' : `${exportSettings.startDate} to ${exportSettings.endDate}`}</p>
          <p><strong>Export Date:</strong> ${new Date().toLocaleDateString('en-GB')}</p>
        </div>

        <div class="summary">
          <div class="summary-card">
            <h3>Total Items</h3>
            <p>${taxSummary?.totalItems || 0}</p>
          </div>
          <div class="summary-card">
            <h3>Total Quantity</h3>
            <p>${taxSummary?.totalQuantity || 0}</p>
          </div>
          <div class="summary-card">
            <h3>Value (Excl. VAT)</h3>
            <p>£${(taxSummary?.totalValue || 0).toFixed(2)}</p>
          </div>
          <div class="summary-card">
            <h3>VAT Amount</h3>
            <p>£${(taxSummary?.vatAmount || 0).toFixed(2)}</p>
          </div>
          <div class="summary-card">
            <h3>Total Value (Incl. VAT)</h3>
            <p>£${(taxSummary?.totalWithVAT || 0).toFixed(2)}</p>
          </div>
        </div>

        ${exportSettings.includeTaxCalculations ? `
        <div class="vat-notice">
          <strong>VAT Information:</strong> VAT calculations shown at ${exportSettings.vatRate}% (UK standard rate). 
          Please verify VAT registration status and applicable rates with your business records.
        </div>
        ` : ''}

        <h3>Inventory Details</h3>
        <table>
          <thead>
            <tr>
              <th>Item Name</th>
              <th>Category</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Total Value</th>
              <th>Status</th>
              <th>Date Added</th>
            </tr>
          </thead>
          <tbody>
            ${filteredItems.map(item=> `
              <tr>
                <td>${item.name}</td>
                <td>${item.category || 'Uncategorized'}</td>
                <td class="number">${item.quantity}</td>
                <td class="number">£${item.unitPrice.toFixed(2)}</td>
                <td class="number">£${(item.quantity * item.unitPrice).toFixed(2)}</td>
                <td>${item.status}</td>
                <td>${item.dateAdded || 'N/A'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p><strong>Important:</strong> This report is generated from Trackio Inventory Management System.</p>
          <p>All values are in British Pounds (GBP). VAT calculations are estimates based on current rates.</p>
          <p>Please consult with your accountant for final tax calculations and submissions.</p>
          <p>For questions about this report, contact: ${user?.email || 'N/A'}</p>
        </div>
      </body>
      </html>
    `;

    // Create and download HTML file (can be opened in browser and printed to PDF)
    const blob=new Blob([htmlContent],{type: 'text/html;charset=utf-8'});
    const link=document.createElement('a');
    const url=URL.createObjectURL(blob);
    link.setAttribute('href',url);
    
    const dateStr=new Date().toISOString().split('T')[0];
    const businessName=(user?.businessName || 'Business').replace(/[^a-zA-Z0-9]/g,'_');
    const fileName=`${businessName}_Tax_Report_${dateStr}.html`;
    
    link.setAttribute('download',fileName);
    link.style.visibility='hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    return fileName;
  };

  const handleExport=async ()=> {
    if (!inventoryData.length) {
      setError('No inventory data to export');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      
      let fileName='';
      
      switch (exportSettings.format) {
        case 'excel':
          fileName=generateExcelReport();
          break;
        case 'csv':
          fileName=generateCSVReport();
          break;
        case 'pdf':
          fileName=generatePDFReport();
          break;
        default:
          throw new Error('Invalid export format');
      }
      
      // Prepare export info for callback
      const exportInfo = {
        format: exportSettings.format,
        fileName,
        recordCount: taxSummary.totalItems,
        totalValue: taxSummary.totalValue,
        vatAmount: taxSummary.vatAmount,
        dateRange: exportSettings.dateRange === 'all' ? 'All Time' : `${exportSettings.startDate} to ${exportSettings.endDate}`,
        settings: exportSettings
      };
      
      // Success message and close modal
      setTimeout(()=> {
        alert(`Tax report exported successfully as ${fileName}!\n\nThis file is ready to send to your accountant.`);
        
        // Call the callback if provided
        if (onExportComplete) {
          onExportComplete(exportInfo);
        }
        
        onClose();
      },500);
      
    } catch (error) {
      console.error('Export error:',error);
      setError('Failed to export report. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDateRangeChange=(range)=> {
    setExportSettings(prev=> ({
      ...prev,
      dateRange: range
    }));

    // Set default date ranges
    const now=new Date();
    let startDate,endDate;

    switch (range) {
      case 'current-year':
        startDate=new Date(now.getFullYear(),0,1);
        endDate=now;
        break;
      case 'last-year':
        startDate=new Date(now.getFullYear() - 1,0,1);
        endDate=new Date(now.getFullYear() - 1,11,31);
        break;
      case 'last-6-months':
        startDate=new Date(now.setMonth(now.getMonth() - 6));
        endDate=new Date();
        break;
      case 'custom':
        // Keep current dates
        return;
      default:
        // 'all' - don't change dates
        return;
    }

    setExportSettings(prev=> ({
      ...prev,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    }));
  };

  useEffect(()=> {
    if (inventoryData.length > 0) {
      calculateTaxSummary(inventoryData);
    }
  },[exportSettings,inventoryData]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{opacity: 0}}
        animate={{opacity: 1}}
        exit={{opacity: 0}}
        className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-90"
      >
        <div className="flex min-h-screen items-center justify-center p-4">
          <motion.div
            initial={{opacity: 0,scale: 0.95}}
            animate={{opacity: 1,scale: 1}}
            exit={{opacity: 0,scale: 0.95}}
            className="relative w-full max-w-4xl bg-gray-800 rounded-lg shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <div className="flex items-center">
                <RiCalculatorLine className="h-6 w-6 text-green-400 mr-2" />
                <h3 className="text-lg font-medium text-white">Tax Export for Accountant</h3>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-300 focus:outline-none"
              >
                <RiCloseLine className="h-6 w-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Export Format Selection */}
              <div>
                <h4 className="text-white font-medium mb-3">Export Format</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    {
                      value: 'excel',
                      label: 'Excel Workbook',
                      description: 'Multi-sheet Excel file with detailed tax calculations',
                      icon: RiFileExcelLine,
                      recommended: true
                    },
                    {
                      value: 'csv',
                      label: 'CSV File',
                      description: 'Simple spreadsheet format for easy import',
                      icon: RiFileTextLine
                    },
                    {
                      value: 'pdf',
                      label: 'PDF Report',
                      description: 'Formatted HTML report (save as PDF from browser)',
                      icon: RiFileTextLine
                    }
                  ].map(format=> (
                    <div
                      key={format.value}
                      onClick={()=> setExportSettings(prev=> ({...prev,format: format.value}))}
                      className={`relative p-4 border rounded-lg cursor-pointer transition-colors ${
                        exportSettings.format === format.value
                          ? 'border-primary-500 bg-primary-500/10'
                          : 'border-gray-600 hover:border-gray-500'
                      }`}
                    >
                      {format.recommended && (
                        <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                          Recommended
                        </div>
                      )}
                      <format.icon className="h-8 w-8 text-primary-400 mb-2" />
                      <h5 className="text-white font-medium">{format.label}</h5>
                      <p className="text-gray-400 text-sm mt-1">{format.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Date Range Selection */}
              <div>
                <h4 className="text-white font-medium mb-3">Reporting Period</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  {[
                    {value: 'all',label: 'All Time'},
                    {value: 'current-year',label: 'Current Tax Year'},
                    {value: 'last-year',label: 'Last Tax Year'},
                    {value: 'custom',label: 'Custom Range'}
                  ].map(range=> (
                    <button
                      key={range.value}
                      onClick={()=> handleDateRangeChange(range.value)}
                      className={`p-3 rounded-lg text-sm font-medium transition-colors ${
                        exportSettings.dateRange === range.value
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>

                {exportSettings.dateRange === 'custom' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={exportSettings.startDate}
                        onChange={(e)=> setExportSettings(prev=> ({...prev,startDate: e.target.value}))}
                        className="w-full rounded-md border-gray-600 bg-gray-700 text-white text-sm p-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={exportSettings.endDate}
                        onChange={(e)=> setExportSettings(prev=> ({...prev,endDate: e.target.value}))}
                        max={new Date().toISOString().split('T')[0]}
                        className="w-full rounded-md border-gray-600 bg-gray-700 text-white text-sm p-2"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Export Options */}
              <div>
                <h4 className="text-white font-medium mb-3">Export Options</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="flex items-center text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={exportSettings.includeZeroValue}
                        onChange={(e)=> setExportSettings(prev=> ({...prev,includeZeroValue: e.target.checked}))}
                        className="mr-2 rounded border-gray-600 bg-gray-700 text-primary-600"
                      />
                      Include zero-value items
                    </label>
                    <label className="flex items-center text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={exportSettings.includeOutOfStock}
                        onChange={(e)=> setExportSettings(prev=> ({...prev,includeOutOfStock: e.target.checked}))}
                        className="mr-2 rounded border-gray-600 bg-gray-700 text-primary-600"
                      />
                      Include out-of-stock items
                    </label>
                    <label className="flex items-center text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={exportSettings.includeTaxCalculations}
                        onChange={(e)=> setExportSettings(prev=> ({...prev,includeTaxCalculations: e.target.checked}))}
                        className="mr-2 rounded border-gray-600 bg-gray-700 text-primary-600"
                      />
                      Include VAT calculations
                    </label>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Report Type
                      </label>
                      <select
                        value={exportSettings.reportType}
                        onChange={(e)=> setExportSettings(prev=> ({...prev,reportType: e.target.value}))}
                        className="w-full rounded-md border-gray-600 bg-gray-700 text-white text-sm p-2"
                      >
                        <option value="full">Full Detailed Report</option>
                        <option value="summary">Category Summary Only</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        VAT Rate (%)
                      </label>
                      <select
                        value={exportSettings.vatRate}
                        onChange={(e)=> setExportSettings(prev=> ({...prev,vatRate: parseInt(e.target.value)}))}
                        className="w-full rounded-md border-gray-600 bg-gray-700 text-white text-sm p-2"
                      >
                        <option value="0">0% (VAT Exempt)</option>
                        <option value="5">5% (Reduced Rate)</option>
                        <option value="20">20% (Standard Rate)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tax Summary Preview */}
              {taxSummary && (
                <div className="bg-gray-700 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-3">Export Preview</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="bg-gray-800 p-3 rounded">
                      <div className="text-gray-400">Items</div>
                      <div className="text-white font-bold text-lg">{taxSummary.totalItems}</div>
                    </div>
                    <div className="bg-gray-800 p-3 rounded">
                      <div className="text-gray-400">Total Quantity</div>
                      <div className="text-white font-bold text-lg">{taxSummary.totalQuantity}</div>
                    </div>
                    <div className="bg-gray-800 p-3 rounded">
                      <div className="text-gray-400">Value (Excl. VAT)</div>
                      <div className="text-white font-bold text-lg">£{taxSummary.totalValue.toFixed(2)}</div>
                    </div>
                    <div className="bg-gray-800 p-3 rounded">
                      <div className="text-gray-400">Total (Incl. VAT)</div>
                      <div className="text-white font-bold text-lg">£{taxSummary.totalWithVAT.toFixed(2)}</div>
                    </div>
                  </div>
                  
                  {exportSettings.includeTaxCalculations && (
                    <div className="mt-3 p-3 bg-blue-900/20 border border-blue-700 rounded">
                      <div className="flex items-center text-blue-300 text-sm">
                        <RiInformationLine className="h-4 w-4 mr-2" />
                        VAT Amount: £{taxSummary.vatAmount.toFixed(2)} at {exportSettings.vatRate}% rate
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Important Information */}
              <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
                <div className="flex items-start">
                  <RiAlertLine className="h-5 w-5 text-yellow-400 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <h5 className="text-yellow-400 font-medium mb-2">Important Tax Information</h5>
                    <ul className="text-yellow-300 text-sm space-y-1">
                      <li>• This report shows current inventory values, not sales/purchases</li>
                      <li>• VAT calculations are estimates - verify with your accountant</li>
                      <li>• Values represent stock on hand for tax year-end reporting</li>
                      <li>• Include this with your annual accounts and tax returns</li>
                      <li>• Keep this export for your records and audit trail</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{opacity: 0,y: -10}}
                  animate={{opacity: 1,y: 0}}
                  className="p-3 bg-red-900/50 border border-red-700 rounded-lg"
                >
                  <div className="flex items-center">
                    <RiAlertLine className="h-4 w-4 text-red-400 mr-2" />
                    <p className="text-red-300 text-sm">{error}</p>
                  </div>
                </motion.div>
              )}

              {/* Actions */}
              <div className="flex justify-between">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExport}
                  disabled={isLoading || !inventoryData.length}
                  className="flex items-center px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <RiDownloadLine className="h-4 w-4 mr-2" />
                      Export Tax Report
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}