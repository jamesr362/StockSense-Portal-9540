import {useState,useEffect} from 'react';
import {motion,AnimatePresence} from 'framer-motion';
import {RiCloseLine,RiDownloadLine,RiFileTextLine,RiFileExcelLine,RiCalendarLine,RiMoneyDollarCircleLine,RiCalculatorLine,RiCheckLine,RiAlertLine,RiInformationLine,RiRefund2Line} from 'react-icons/ri';
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
    vatRegistered: true, // Assume VAT registered for calculations
    vatRate: 20, // UK VAT rate
    currencyFormat: 'GBP',
    reportType: 'full',
    calculationMethod: 'inclusive' // VAT inclusive prices (most common for purchases)
  });
  const [vatSummary,setVatSummary]=useState(null);
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
      calculateVatSummary(items);
    } catch (error) {
      console.error('Error loading inventory data:',error);
      setError('Failed to load inventory data');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateVatSummary=(items)=> {
    const filteredItems=filterItemsByDateRange(items);
    
    const totalCostValue=filteredItems.reduce((sum,item)=> 
      sum + (item.quantity * item.unitPrice),0
    );
    
    // Calculate VAT refund based on calculation method
    let vatRefundAmount = 0;
    let netCostValue = 0;
    
    if (exportSettings.vatRegistered) {
      if (exportSettings.calculationMethod === 'inclusive') {
        // VAT inclusive prices - extract VAT from total
        vatRefundAmount = totalCostValue * (exportSettings.vatRate / (100 + exportSettings.vatRate));
        netCostValue = totalCostValue - vatRefundAmount;
      } else {
        // VAT exclusive prices - add VAT to get total
        netCostValue = totalCostValue;
        vatRefundAmount = totalCostValue * (exportSettings.vatRate / 100);
      }
    } else {
      netCostValue = totalCostValue;
      vatRefundAmount = 0;
    }
    
    const categoryBreakdown=filteredItems.reduce((acc,item)=> {
      const category=item.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category]={
          items: 0,
          quantity: 0,
          totalCost: 0,
          vatRefund: 0,
          netCost: 0
        };
      }
      
      const itemCost = item.quantity * item.unitPrice;
      let itemVatRefund = 0;
      let itemNetCost = itemCost;
      
      if (exportSettings.vatRegistered) {
        if (exportSettings.calculationMethod === 'inclusive') {
          itemVatRefund = itemCost * (exportSettings.vatRate / (100 + exportSettings.vatRate));
          itemNetCost = itemCost - itemVatRefund;
        } else {
          itemVatRefund = itemCost * (exportSettings.vatRate / 100);
          itemNetCost = itemCost;
        }
      }
      
      acc[category].items++;
      acc[category].quantity += item.quantity;
      acc[category].totalCost += itemCost;
      acc[category].vatRefund += itemVatRefund;
      acc[category].netCost += itemNetCost;
      
      return acc;
    },{});

    // Calculate potential quarterly and annual refunds
    const quarterlyRefund = vatRefundAmount / 4; // Quarterly VAT returns
    const annualRefund = vatRefundAmount;

    setVatSummary({
      totalItems: filteredItems.length,
      totalQuantity: filteredItems.reduce((sum,item)=> sum + item.quantity,0),
      totalCostValue,
      vatRefundAmount,
      netCostValue,
      quarterlyRefund,
      annualRefund,
      categoryBreakdown,
      averageVatPerItem: filteredItems.length > 0 ? vatRefundAmount / filteredItems.length : 0,
      vatPercentage: totalCostValue > 0 ? (vatRefundAmount / totalCostValue) * 100 : 0,
      dateRange: {
        start: exportSettings.startDate,
        end: exportSettings.endDate
      }
    });
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
      const categoryData=Object.entries(vatSummary.categoryBreakdown).map(([category,data])=> ({
        'Category': category,
        'Total Items': data.items,
        'Total Quantity': data.quantity,
        'Total Cost': data.totalCost,
        'VAT Refund Available': data.vatRefund,
        'Net Cost (Ex-VAT)': data.netCost,
        'Average VAT per Item': data.items > 0 ? data.vatRefund / data.items : 0
      }));
      
      reportData=categoryData;
    } else {
      // Full detailed report
      reportData=filteredItems.map(item=> {
        const itemCost=item.quantity * item.unitPrice;
        let itemVatRefund = 0;
        let itemNetCost = itemCost;
        
        if (exportSettings.vatRegistered) {
          if (exportSettings.calculationMethod === 'inclusive') {
            itemVatRefund = itemCost * (exportSettings.vatRate / (100 + exportSettings.vatRate));
            itemNetCost = itemCost - itemVatRefund;
          } else {
            itemVatRefund = itemCost * (exportSettings.vatRate / 100);
            itemNetCost = itemCost;
          }
        }
        
        return {
          'Item Name': item.name,
          'Category': item.category || 'Uncategorized',
          'Quantity': item.quantity,
          'Unit Price': item.unitPrice,
          'Total Cost': itemCost,
          'VAT Refund Available': itemVatRefund,
          'Net Cost (Ex-VAT)': itemNetCost,
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
    XLSX.utils.book_append_sheet(wb,ws,exportSettings.reportType === 'summary' ? 'Category Summary' : 'VAT Refund Details');

    // VAT summary sheet
    const vatSummaryData=[
      ['VAT REFUND REPORT',''],
      ['Generated on:',new Date().toLocaleDateString('en-GB')],
      ['Business Name:',user?.businessName || ''],
      ['Export Period:',exportSettings.dateRange === 'all' ? 'All Time' : `${exportSettings.startDate} to ${exportSettings.endDate}`],
      ['VAT Registered:',exportSettings.vatRegistered ? 'Yes' : 'No'],
      ['',''],
      ['VAT REFUND SUMMARY',''],
      ['Total Items:',vatSummary.totalItems],
      ['Total Quantity:',vatSummary.totalQuantity],
      ['Total Purchase Cost:',`£${vatSummary.totalCostValue.toFixed(2)}`],
      ['VAT Rate:',`${exportSettings.vatRate}%`],
      ['VAT Refund Available:',`£${vatSummary.vatRefundAmount.toFixed(2)}`],
      ['Net Cost (Ex-VAT):',`£${vatSummary.netCostValue.toFixed(2)}`],
      ['Average VAT per Item:',`£${vatSummary.averageVatPerItem.toFixed(2)}`],
      ['',''],
      ['QUARTERLY VAT RETURNS',''],
      ['Quarterly Refund Potential:',`£${vatSummary.quarterlyRefund.toFixed(2)}`],
      ['Annual Refund Potential:',`£${vatSummary.annualRefund.toFixed(2)}`],
      ['',''],
      ['CATEGORY BREAKDOWN','']
    ];

    // Add category breakdown
    Object.entries(vatSummary.categoryBreakdown).forEach(([category,data])=> {
      vatSummaryData.push([
        category,
        `${data.items} items`,
        `Cost: £${data.totalCost.toFixed(2)}`,
        `VAT Refund: £${data.vatRefund.toFixed(2)}`
      ]);
    });

    const vatWs=XLSX.utils.aoa_to_sheet(vatSummaryData);
    XLSX.utils.book_append_sheet(wb,vatWs,'VAT Summary');

    // Accountant notes sheet
    const notesData=[
      ['VAT REFUND REPORT - ACCOUNTANT NOTES',''],
      ['',''],
      ['REPORT DETAILS',''],
      ['Report Generated:',new Date().toLocaleString('en-GB')],
      ['Generated By:',user?.businessName || ''],
      ['Email:',user?.email || ''],
      ['System:','Trackio Inventory Management'],
      ['',''],
      ['VAT INFORMATION',''],
      ['Currency:','British Pounds (GBP)'],
      ['VAT Registration Status:',exportSettings.vatRegistered ? 'Registered for VAT' : 'Not VAT Registered'],
      ['VAT Rate Used:',`${exportSettings.vatRate}% (UK Standard Rate)`],
      ['Calculation Method:',exportSettings.calculationMethod === 'inclusive' ? 'VAT Inclusive Prices' : 'VAT Exclusive Prices'],
      ['Reporting Period:',exportSettings.dateRange === 'all' ? 'All Time' : `${exportSettings.startDate} to ${exportSettings.endDate}`],
      ['',''],
      ['IMPORTANT NOTES FOR ACCOUNTANT',''],
      ['1. VAT Refunds:','Only available if business is VAT registered with HMRC'],
      ['2. Calculation Method:',exportSettings.calculationMethod === 'inclusive' ? 'VAT extracted from inclusive purchase prices' : 'VAT calculated on exclusive prices'],
      ['3. Documentation:','Ensure all purchase invoices show VAT separately'],
      ['4. Quarterly Returns:','Submit VAT returns quarterly to claim refunds'],
      ['5. Record Keeping:','Keep all purchase receipts for HMRC compliance'],
      ['6. Categories:','Items grouped by business categories for analysis'],
      ['7. Verification:','All data extracted from Trackio inventory system'],
      ['8. Cash Flow:','VAT refunds improve business cash flow'],
      ['',''],
      ['VAT REGISTRATION GUIDANCE',''],
      ['Mandatory Registration:','Annual turnover exceeds £85,000 (2024)'],
      ['Voluntary Registration:','Register below threshold to reclaim VAT'],
      ['Benefits:','Reclaim VAT on business purchases and expenses'],
      ['Quarterly Returns:','Submit online by 1 month and 7 days after quarter end'],
      ['',''],
      ['EXPORT SETTINGS USED',''],
      ['Include Zero Value Items:',exportSettings.includeZeroValue ? 'Yes' : 'No'],
      ['Include Out of Stock:',exportSettings.includeOutOfStock ? 'Yes' : 'No'],
      ['Group by Category:',exportSettings.groupByCategory ? 'Yes' : 'No'],
      ['VAT Registered Business:',exportSettings.vatRegistered ? 'Yes' : 'No'],
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
    const fileName=`${businessName}_VAT_Refund_Report_${dateStr}.xlsx`;

    // Download file
    XLSX.writeFile(wb,fileName);
    
    return fileName;
  };

  const generateCSVReport=()=> {
    const filteredItems=filterItemsByDateRange(inventoryData);
    
    const csvData=filteredItems.map(item=> {
      const itemCost=item.quantity * item.unitPrice;
      let itemVatRefund = 0;
      let itemNetCost = itemCost;
      
      if (exportSettings.vatRegistered) {
        if (exportSettings.calculationMethod === 'inclusive') {
          itemVatRefund = itemCost * (exportSettings.vatRate / (100 + exportSettings.vatRate));
          itemNetCost = itemCost - itemVatRefund;
        } else {
          itemVatRefund = itemCost * (exportSettings.vatRate / 100);
          itemNetCost = itemCost;
        }
      }
      
      return {
        'Item Name': item.name,
        'Category': item.category || 'Uncategorized',
        'Quantity': item.quantity,
        'Unit Price': item.unitPrice,
        'Total Cost': itemCost,
        'VAT Refund Available': itemVatRefund,
        'Net Cost (Ex-VAT)': itemNetCost,
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
      `VAT Refund Report - ${user?.businessName || 'Business'}`,
      `Generated: ${new Date().toLocaleString('en-GB')}`,
      `Period: ${exportSettings.dateRange === 'all' ? 'All Time' : `${exportSettings.startDate} to ${exportSettings.endDate}`}`,
      `VAT Rate: ${exportSettings.vatRate}%`,
      `VAT Registered: ${exportSettings.vatRegistered ? 'Yes' : 'No'}`,
      `Total VAT Refund Available: £${vatSummary?.vatRefundAmount?.toFixed(2) || '0.00'}`,
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
    const fileName=`${businessName}_VAT_Refund_Report_${dateStr}.csv`;
    
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
        <title>VAT Refund Report - ${user?.businessName || 'Business'}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
          .business-info { background: #f5f5f5; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
          .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
          .summary-card { background: #f9f9f9; padding: 15px; border-left: 4px solid #10b981; }
          .summary-card h3 { margin: 0 0 5px 0; color: #10b981; }
          .summary-card p { margin: 0; font-size: 18px; font-weight: bold; }
          .refund-highlight { background: #dcfce7; border: 2px solid #10b981; padding: 15px; border-radius: 8px; margin: 20px 0; }
          .refund-highlight h3 { color: #047857; margin: 0 0 10px 0; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
          .number { text-align: right; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
          .vat-notice { background: #dbeafe; border: 1px solid #60a5fa; padding: 10px; margin: 20px 0; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>VAT Refund Report</h1>
          <h2>${user?.businessName || 'Business Name'}</h2>
          <p>Generated on ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB')}</p>
        </div>
        
        <div class="business-info">
          <h3>Business Information</h3>
          <p><strong>Business Name:</strong> ${user?.businessName || 'N/A'}</p>
          <p><strong>Email:</strong> ${user?.email || 'N/A'}</p>
          <p><strong>Report Period:</strong> ${exportSettings.dateRange === 'all' ? 'All Time' : `${exportSettings.startDate} to ${exportSettings.endDate}`}</p>
          <p><strong>VAT Registration:</strong> ${exportSettings.vatRegistered ? 'VAT Registered' : 'Not VAT Registered'}</p>
          <p><strong>Export Date:</strong> ${new Date().toLocaleDateString('en-GB')}</p>
        </div>

        ${exportSettings.vatRegistered ? `
        <div class="refund-highlight">
          <h3>💰 Potential VAT Refund Available</h3>
          <p style="font-size: 24px; margin: 10px 0;"><strong>£${(vatSummary?.vatRefundAmount || 0).toFixed(2)}</strong></p>
          <p>This amount can be claimed back through your quarterly VAT return to HMRC.</p>
          <p><strong>Quarterly Potential:</strong> £${(vatSummary?.quarterlyRefund || 0).toFixed(2)} per quarter</p>
        </div>
        ` : `
        <div class="vat-notice">
          <strong>VAT Registration Required:</strong> To claim VAT refunds, your business must be registered for VAT with HMRC.
          Consider voluntary registration if your VAT refunds would exceed the administrative costs.
        </div>
        `}

        <div class="summary">
          <div class="summary-card">
            <h3>Total Items</h3>
            <p>${vatSummary?.totalItems || 0}</p>
          </div>
          <div class="summary-card">
            <h3>Total Quantity</h3>
            <p>${vatSummary?.totalQuantity || 0}</p>
          </div>
          <div class="summary-card">
            <h3>Total Purchase Cost</h3>
            <p>£${(vatSummary?.totalCostValue || 0).toFixed(2)}</p>
          </div>
          <div class="summary-card">
            <h3>Net Cost (Ex-VAT)</h3>
            <p>£${(vatSummary?.netCostValue || 0).toFixed(2)}</p>
          </div>
        </div>

        <h3>Inventory Details with VAT Refunds</h3>
        <table>
          <thead>
            <tr>
              <th>Item Name</th>
              <th>Category</th>
              <th>Qty</th>
              <th>Total Cost</th>
              <th>VAT Refund</th>
              <th>Net Cost</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${filteredItems.map(item=> {
              const itemCost = item.quantity * item.unitPrice;
              let itemVatRefund = 0;
              let itemNetCost = itemCost;
              
              if (exportSettings.vatRegistered) {
                if (exportSettings.calculationMethod === 'inclusive') {
                  itemVatRefund = itemCost * (exportSettings.vatRate / (100 + exportSettings.vatRate));
                  itemNetCost = itemCost - itemVatRefund;
                } else {
                  itemVatRefund = itemCost * (exportSettings.vatRate / 100);
                  itemNetCost = itemCost;
                }
              }
              
              return `
              <tr>
                <td>${item.name}</td>
                <td>${item.category || 'Uncategorized'}</td>
                <td class="number">${item.quantity}</td>
                <td class="number">£${itemCost.toFixed(2)}</td>
                <td class="number" style="color: #10b981; font-weight: bold;">£${itemVatRefund.toFixed(2)}</td>
                <td class="number">£${itemNetCost.toFixed(2)}</td>
                <td>${item.status}</td>
              </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p><strong>Important:</strong> This report is generated from Trackio Inventory Management System.</p>
          <p>VAT refunds are only available to VAT-registered businesses. Consult your accountant for VAT registration advice.</p>
          <p>All calculations are estimates based on ${exportSettings.vatRate}% VAT rate. Verify with your purchase invoices.</p>
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
    const fileName=`${businessName}_VAT_Refund_Report_${dateStr}.html`;
    
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
        recordCount: vatSummary.totalItems,
        totalValue: vatSummary.totalCostValue,
        vatRefundAmount: vatSummary.vatRefundAmount,
        dateRange: exportSettings.dateRange === 'all' ? 'All Time' : `${exportSettings.startDate} to ${exportSettings.endDate}`,
        settings: exportSettings
      };
      
      // Success message and close modal
      setTimeout(()=> {
        const message = exportSettings.vatRegistered 
          ? `VAT refund report exported successfully as ${fileName}!\n\nPotential VAT refund: £${vatSummary.vatRefundAmount.toFixed(2)}\n\nThis file is ready to send to your accountant for VAT return preparation.`
          : `VAT report exported successfully as ${fileName}!\n\nNote: VAT registration required to claim refunds.\n\nThis file shows potential savings if you register for VAT.`;
        
        alert(message);
        
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
      calculateVatSummary(inventoryData);
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
                <RiRefund2Line className="h-6 w-6 text-green-400 mr-2" />
                <h3 className="text-lg font-medium text-white">VAT Refund Calculator</h3>
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
                      description: 'Multi-sheet Excel file with detailed VAT calculations',
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

              {/* VAT Settings */}
              <div>
                <h4 className="text-white font-medium mb-3">VAT Settings</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="flex items-center text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={exportSettings.vatRegistered}
                        onChange={(e)=> setExportSettings(prev=> ({...prev,vatRegistered: e.target.checked}))}
                        className="mr-2 rounded border-gray-600 bg-gray-700 text-green-600"
                      />
                      Business is VAT registered
                    </label>
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
                  </div>
                  <div className="space-y-3">
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
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Price Method
                      </label>
                      <select
                        value={exportSettings.calculationMethod}
                        onChange={(e)=> setExportSettings(prev=> ({...prev,calculationMethod: e.target.value}))}
                        className="w-full rounded-md border-gray-600 bg-gray-700 text-white text-sm p-2"
                      >
                        <option value="inclusive">VAT Inclusive Prices</option>
                        <option value="exclusive">VAT Exclusive Prices</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* VAT Summary Preview */}
              {vatSummary && (
                <div className="bg-gray-700 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-3">VAT Refund Preview</h4>
                  
                  {exportSettings.vatRegistered ? (
                    <div className="bg-green-900/20 border border-green-700 rounded-lg p-4 mb-4">
                      <div className="flex items-center mb-2">
                        <RiRefund2Line className="h-5 w-5 text-green-400 mr-2" />
                        <h5 className="text-green-400 font-medium">Potential VAT Refund</h5>
                      </div>
                      <div className="text-2xl font-bold text-green-400 mb-1">
                        £{vatSummary.vatRefundAmount.toFixed(2)}
                      </div>
                      <div className="text-sm text-green-300">
                        Quarterly: £{vatSummary.quarterlyRefund.toFixed(2)} • Annual: £{vatSummary.annualRefund.toFixed(2)}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 mb-4">
                      <div className="flex items-center text-blue-300 text-sm">
                        <RiInformationLine className="h-4 w-4 mr-2" />
                        VAT registration required to claim refunds. Report shows potential savings if registered.
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="bg-gray-800 p-3 rounded">
                      <div className="text-gray-400">Items</div>
                      <div className="text-white font-bold text-lg">{vatSummary.totalItems}</div>
                    </div>
                    <div className="bg-gray-800 p-3 rounded">
                      <div className="text-gray-400">Total Cost</div>
                      <div className="text-white font-bold text-lg">£{vatSummary.totalCostValue.toFixed(2)}</div>
                    </div>
                    <div className="bg-gray-800 p-3 rounded">
                      <div className="text-gray-400">VAT Refund</div>
                      <div className="text-green-400 font-bold text-lg">£{vatSummary.vatRefundAmount.toFixed(2)}</div>
                    </div>
                    <div className="bg-gray-800 p-3 rounded">
                      <div className="text-gray-400">Net Cost</div>
                      <div className="text-white font-bold text-lg">£{vatSummary.netCostValue.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Important Information */}
              <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                <div className="flex items-start">
                  <RiAlertLine className="h-5 w-5 text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <h5 className="text-blue-400 font-medium mb-2">Important VAT Information</h5>
                    <ul className="text-blue-300 text-sm space-y-1">
                      <li>• VAT refunds only available to VAT-registered businesses</li>
                      <li>• Submit quarterly VAT returns to HMRC to claim refunds</li>
                      <li>• Keep all purchase invoices showing VAT separately</li>
                      <li>• Consider voluntary VAT registration if refunds exceed costs</li>
                      <li>• VAT registration mandatory if turnover exceeds £85,000 annually</li>
                      <li>• Consult your accountant for VAT registration advice</li>
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
                      Export VAT Report
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