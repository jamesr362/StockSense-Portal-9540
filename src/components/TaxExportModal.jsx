import {useState,useEffect} from 'react';
import {motion,AnimatePresence} from 'framer-motion';
import {RiCloseLine,RiDownloadLine,RiFileTextLine,RiFileExcelLine,RiCalendarLine,RiMoneyDollarCircleLine,RiCalculatorLine,RiCheckLine,RiAlertLine,RiInformationLine,RiRefund2Line} from 'react-icons/ri';
import * as XLSX from 'xlsx';
import {getPurchaseItems} from '../services/db';
import {useAuth} from '../context/AuthContext';

const formatCurrency=(value)=> {
  // Use proper pound symbol without encoding issues
  return `£${(value || 0).toFixed(2)}`;
};

export default function TaxExportModal({isOpen,onClose,onExportComplete}) {
  const [isLoading,setIsLoading]=useState(false);
  const [purchaseData,setPurchaseData]=useState([]);
  const [exportSettings,setExportSettings]=useState({
    format: 'excel',
    dateRange: 'all',
    startDate: new Date(new Date().getFullYear(),0,1).toISOString().split('T')[0], // Start of current year
    endDate: new Date().toISOString().split('T')[0], // Today
    includeZeroValue: true,
    includeOutOfStock: true,
    groupByCategory: false,
    vatRate: 20, // UK VAT rate
    currencyFormat: 'GBP',
    reportType: 'full'
  });
  const [vatSummary,setVatSummary]=useState(null);
  const [error,setError]=useState('');
  const {user}=useAuth();

  useEffect(()=> {
    if (isOpen && user?.email) {
      loadPurchaseData();
    }
  },[isOpen,user?.email]);

  const loadPurchaseData=async ()=> {
    try {
      setIsLoading(true);
      const items=await getPurchaseItems(user.email);
      setPurchaseData(items);
      calculateVatSummary(items);
    } catch (error) {
      console.error('Error loading purchase data:',error);
      setError('Failed to load purchase data');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateVatSummary=(items)=> {
    const filteredItems=filterItemsByDateRange(items);
    
    // ONLY process VAT-included items
    const vatIncludedItems = filteredItems.filter(item => item.vatIncluded === true);
    
    // Calculate total based on VAT-included items only
    const totalPurchaseCost=vatIncludedItems.reduce((sum,item)=> {
      const itemCost = item.quantity * item.unitPrice;
      return sum + itemCost;
    }, 0);
    
    // Calculate VAT reclaim from VAT-included prices only
    const vatReclaim = vatIncludedItems.reduce((sum, item) => {
      const vatPercentage = item.vatPercentage || exportSettings.vatRate;
      const itemCost = item.quantity * item.unitPrice;
      // Price includes VAT - extract VAT amount
      const itemVatReclaim = itemCost * (vatPercentage / (100 + vatPercentage));
      return sum + itemVatReclaim;
    }, 0);
    
    const netCostValue = totalPurchaseCost - vatReclaim;
    
    const categoryBreakdown=vatIncludedItems.reduce((acc,item)=> {
      const category=item.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category]={
          items: 0,
          quantity: 0,
          totalCost: 0,
          vatReclaim: 0,
          netCost: 0
        };
      }
      
      const vatPercentage = item.vatPercentage || exportSettings.vatRate;
      const itemCost = item.quantity * item.unitPrice;
      // Only VAT-included items, so always extract VAT
      const itemVatReclaim = itemCost * (vatPercentage / (100 + vatPercentage));
      const itemNetCost = itemCost - itemVatReclaim;
      
      acc[category].items++;
      acc[category].quantity += item.quantity;
      acc[category].totalCost += itemCost;
      acc[category].vatReclaim += itemVatReclaim;
      acc[category].netCost += itemNetCost;
      
      return acc;
    },{});

    // Calculate potential quarterly and annual benefits
    const quarterlyBenefit = vatReclaim / 4;
    const annualBenefit = vatReclaim;

    setVatSummary({
      totalItems: vatIncludedItems.length,
      totalQuantity: vatIncludedItems.reduce((sum,item)=> sum + item.quantity,0),
      totalPurchaseCost,
      vatReclaim,
      netCostValue,
      quarterlyBenefit,
      annualBenefit,
      categoryBreakdown,
      averageBenefitPerItem: vatIncludedItems.length > 0 ? vatReclaim / vatIncludedItems.length : 0,
      benefitPercentage: totalPurchaseCost > 0 ? (vatReclaim / totalPurchaseCost) * 100 : 0,
      dateRange: {
        start: exportSettings.startDate,
        end: exportSettings.endDate
      },
      excludedItems: filteredItems.length - vatIncludedItems.length // Track excluded items
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

    return filtered;
  };

  const generateExcelReport=()=> {
    const filteredItems=filterItemsByDateRange(purchaseData);
    // ONLY process VAT-included items
    const vatIncludedItems = filteredItems.filter(item => item.vatIncluded === true);
    
    // Prepare data based on report type
    let reportData=[];
    
    if (exportSettings.reportType === 'summary') {
      // Summary report by category
      const categoryData=Object.entries(vatSummary.categoryBreakdown).map(([category,data])=> ({
        'Category': category,
        'Total Items': data.items,
        'Total Quantity': data.quantity,
        'Total Purchase Cost': data.totalCost.toFixed(2),
        'VAT Reclaim Available': data.vatReclaim.toFixed(2),
        'Net Cost After VAT': data.netCost.toFixed(2),
        'Average VAT Reclaim per Item': (data.items > 0 ? data.vatReclaim / data.items : 0).toFixed(2)
      }));
      
      reportData=categoryData;
    } else {
      // Full detailed report - only VAT-included items
      reportData=vatIncludedItems.map(item=> {
        const vatPercentage = item.vatPercentage || exportSettings.vatRate;
        const itemCost = item.quantity * item.unitPrice;
        // Only VAT-included items, so always extract VAT
        const itemVatReclaim = itemCost * (vatPercentage / (100 + vatPercentage));
        const itemNetCost = itemCost - itemVatReclaim;
        
        return {
          'Item Name': item.name,
          'Category': item.category || 'Uncategorized',
          'Quantity': item.quantity,
          'Unit Price (VAT Inc.)': item.unitPrice.toFixed(2),
          'VAT Rate': `${vatPercentage}%`,
          'Total Purchase Cost': itemCost.toFixed(2),
          'VAT Reclaim Available': itemVatReclaim.toFixed(2),
          'Net Cost After VAT': itemNetCost.toFixed(2),
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
    XLSX.utils.book_append_sheet(wb,ws,exportSettings.reportType === 'summary' ? 'Category Summary' : 'VAT Reclaim Details');

    // VAT summary sheet
    const vatSummaryData=[
      ['VAT RECLAIM REPORT - VAT INCLUDED ITEMS ONLY',''],
      ['Generated on:',new Date().toLocaleDateString('en-GB')],
      ['Business Name:',user?.businessName || ''],
      ['Export Period:',exportSettings.dateRange === 'all' ? 'All Time' : `${exportSettings.startDate} to ${exportSettings.endDate}`],
      ['VAT Registration Status:','VAT Registered'],
      ['Report Scope:','VAT-included items only'],
      ['',''],
      ['VAT RECLAIM SUMMARY',''],
      ['VAT-Included Items:',vatSummary.totalItems],
      ['Excluded Items (VAT not included):',vatSummary.excludedItems || 0],
      ['Total Quantity:',vatSummary.totalQuantity],
      ['Total Purchase Cost:',vatSummary.totalPurchaseCost.toFixed(2)],
      ['VAT Rate Used:',`${exportSettings.vatRate}%`],
      ['VAT Reclaim Available:',vatSummary.vatReclaim.toFixed(2)],
      ['Net Cost After VAT:',vatSummary.netCostValue.toFixed(2)],
      ['Average VAT Reclaim per Item:',vatSummary.averageBenefitPerItem.toFixed(2)],
      ['',''],
      ['CALCULATION METHOD',''],
      ['Description:','VAT extracted from VAT-inclusive purchase prices only'],
      ['Scope:','Only items marked as "VAT Included" are processed'],
      ['VAT Reclaim Formula:','VAT = (Purchase Price x VAT%) / (100 + VAT%)'],
      ['Example:',`£120.00 VAT-inclusive purchase = (£120.00 x 20) / 120 = £20.00 VAT reclaim`],
      ['How to Claim:','Submit quarterly VAT returns to HMRC'],
      ['Requirements:','Must be VAT registered with HMRC'],
      ['',''],
      ['CATEGORY BREAKDOWN','']
    ];

    // Add category breakdown
    Object.entries(vatSummary.categoryBreakdown).forEach(([category,data])=> {
      vatSummaryData.push([
        category,
        `${data.items} items`,
        `Cost: ${data.totalCost.toFixed(2)}`,
        `VAT Reclaim: ${data.vatReclaim.toFixed(2)}`
      ]);
    });

    const vatWs=XLSX.utils.aoa_to_sheet(vatSummaryData);
    XLSX.utils.book_append_sheet(wb,vatWs,'VAT Reclaim Summary');

    // Accountant notes sheet
    const notesData=[
      ['VAT RECLAIM REPORT - ACCOUNTANT NOTES',''],
      ['',''],
      ['REPORT DETAILS',''],
      ['Report Generated:',new Date().toLocaleString('en-GB')],
      ['Generated By:',user?.businessName || ''],
      ['Email:',user?.email || ''],
      ['System:','Trackio Purchase Tracker'],
      ['VAT Registration:','VAT Registered Business'],
      ['Report Scope:','VAT-included items only'],
      ['',''],
      ['VAT RECLAIM CALCULATION METHOD',''],
      ['Calculation Type:','VAT extraction from VAT-inclusive purchase prices'],
      ['Items Processed:','Only items marked as "VAT Included" = Yes'],
      ['Items Excluded:','Items with "VAT Included" = No are excluded from calculations'],
      ['VAT Rate Used:',`${exportSettings.vatRate}% (UK Standard Rate)`],
      ['Formula:','VAT Amount = (Purchase Price x VAT Rate) / (100 + VAT Rate)'],
      ['Example:',`£120.00 VAT-inclusive purchase = (£120.00 x 20) / 120 = £20.00 VAT reclaim`],
      ['Net Cost:','Purchase Price - VAT Amount'],
      ['',''],
      ['IMPORTANT: VAT-INCLUDED ITEMS ONLY',''],
      ['This report only processes items where VAT is included in the purchase price.'],
      ['Items purchased without VAT (VAT Included = No) are excluded.'],
      ['This ensures accurate VAT reclaim calculations for HMRC submissions.'],
      ['Only VAT-inclusive purchases are eligible for VAT reclaims.'],
      ['',''],
      ['HOW TO CLAIM VAT RECLAIMS',''],
      ['1. VAT Registration:','Business must be registered for VAT with HMRC'],
      ['2. Quarterly Returns:','Submit VAT returns quarterly online'],
      ['3. Documentation:','Keep all purchase invoices showing VAT separately'],
      ['4. Deadlines:','Submit by 1 month and 7 days after quarter end'],
      ['5. Cash Flow:','VAT reclaims improve business cash flow'],
      ['6. Compliance:','Maintain VAT records for 6 years minimum'],
      ['',''],
      ['EXPORT SETTINGS USED',''],
      ['Include Zero Value Items:',exportSettings.includeZeroValue ? 'Yes' : 'No'],
      ['Group by Category:',exportSettings.groupByCategory ? 'Yes' : 'No'],
      ['VAT Registration Status:','VAT Registered'],
      ['Report Type:',exportSettings.reportType === 'summary' ? 'Category Summary' : 'Full Detailed Report'],
      ['VAT-Included Items Only:','Yes - Non-VAT items excluded'],
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
    const fileName=`${businessName}_VAT_Reclaim_Report_${dateStr}.xlsx`;

    // Download file
    XLSX.writeFile(wb,fileName);
    
    return fileName;
  };

  const generateCSVReport=()=> {
    const filteredItems=filterItemsByDateRange(purchaseData);
    // ONLY process VAT-included items
    const vatIncludedItems = filteredItems.filter(item => item.vatIncluded === true);
    
    const csvData=vatIncludedItems.map(item=> {
      const vatPercentage = item.vatPercentage || exportSettings.vatRate;
      const itemCost = item.quantity * item.unitPrice;
      // Only VAT-included items, so always extract VAT
      const itemVatReclaim = itemCost * (vatPercentage / (100 + vatPercentage));
      const itemNetCost = itemCost - itemVatReclaim;
      
      return {
        'Item Name': item.name,
        'Category': item.category || 'Uncategorized',
        'Quantity': item.quantity,
        'Unit Price (VAT Inc.)': item.unitPrice.toFixed(2),
        'VAT Rate': `${vatPercentage}%`,
        'Total Purchase Cost': itemCost.toFixed(2),
        'VAT Reclaim Available': itemVatReclaim.toFixed(2),
        'Net Cost After VAT': itemNetCost.toFixed(2),
        'Date Added': item.dateAdded,
        'Description': item.description || '',
        'SKU': item.id || ''
      };
    });

    // Convert to CSV
    const headers=Object.keys(csvData[0] || {});
    const csvContent=[
      // Header with business info
      `VAT Reclaim Report - VAT Included Items Only - ${user?.businessName || 'Business'}`,
      `Generated: ${new Date().toLocaleString('en-GB')}`,
      `Period: ${exportSettings.dateRange === 'all' ? 'All Time' : `${exportSettings.startDate} to ${exportSettings.endDate}`}`,
      `VAT Rate: ${exportSettings.vatRate}%`,
      `VAT Registration Status: VAT Registered`,
      `Report Scope: VAT-included items only`,
      `Calculation Method: VAT extracted from VAT-inclusive purchase prices`,
      `VAT-Included Items Processed: ${vatSummary?.totalItems || 0}`,
      `Excluded Items (No VAT): ${vatSummary?.excludedItems || 0}`,
      `Total VAT Reclaim Available: ${vatSummary?.vatReclaim?.toFixed(2) || '0.00'}`,
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
    const fileName=`${businessName}_VAT_Reclaim_Report_${dateStr}.csv`;
    
    link.setAttribute('download',fileName);
    link.style.visibility='hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    return fileName;
  };

  const generatePDFReport=()=> {
    // Generate HTML content for PDF
    const filteredItems=filterItemsByDateRange(purchaseData);
    // ONLY process VAT-included items
    const vatIncludedItems = filteredItems.filter(item => item.vatIncluded === true);
    
    const htmlContent=`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>VAT Reclaim Report - VAT Included Items Only - ${user?.businessName || 'Business'}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
          .business-info { background: #f5f5f5; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
          .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
          .summary-card { background: #f9f9f9; padding: 15px; border-left: 4px solid #10b981; }
          .summary-card h3 { margin: 0 0 5px 0; color: #10b981; }
          .summary-card p { margin: 0; font-size: 18px; font-weight: bold; }
          .benefit-highlight { background: #dcfce7; border: 2px solid #10b981; padding: 15px; border-radius: 8px; margin: 20px 0; }
          .benefit-highlight h3 { color: #047857; margin: 0 0 10px 0; }
          .calculation-info { background: #dbeafe; border: 1px solid #60a5fa; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .scope-info { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 5px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
          .number { text-align: right; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
          .notice { background: #dbeafe; border: 1px solid #60a5fa; padding: 10px; margin: 20px 0; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>VAT Reclaim Report</h1>
          <h2>${user?.businessName || 'Business Name'}</h2>
          <p><strong>VAT-Included Items Only</strong></p>
          <p>Generated on ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB')}</p>
        </div>
        
        <div class="business-info">
          <h3>Business Information</h3>
          <p><strong>Business Name:</strong> ${user?.businessName || 'N/A'}</p>
          <p><strong>Email:</strong> ${user?.email || 'N/A'}</p>
          <p><strong>Report Period:</strong> ${exportSettings.dateRange === 'all' ? 'All Time' : `${exportSettings.startDate} to ${exportSettings.endDate}`}</p>
          <p><strong>VAT Registration Status:</strong> VAT Registered</p>
          <p><strong>Report Scope:</strong> VAT-included items only</p>
          <p><strong>Export Date:</strong> ${new Date().toLocaleDateString('en-GB')}</p>
        </div>

        <div class="scope-info">
          <h3>⚠️ Important: VAT-Included Items Only</h3>
          <p><strong>This report only processes items where VAT is included in the purchase price.</strong></p>
          <p>• VAT-Included Items Processed: <strong>${vatSummary?.totalItems || 0}</strong></p>
          <p>• Excluded Items (No VAT): <strong>${vatSummary?.excludedItems || 0}</strong></p>
          <p>• Only VAT-inclusive purchases are eligible for VAT reclaims from HMRC.</p>
        </div>

        <div class="calculation-info">
          <h3>VAT Reclaim Calculation Method</h3>
          <p><strong>Method:</strong> VAT extraction from VAT-inclusive purchase prices only</p>
          <p><strong>Formula:</strong> VAT Amount = (Purchase Price x ${exportSettings.vatRate}%) / ${100 + exportSettings.vatRate}%</p>
          <p><strong>Example:</strong> £120.00 VAT-inclusive purchase = (£120.00 x 20) / 120 = £20.00 VAT reclaim</p>
          <p><strong>How to Claim:</strong> Submit quarterly VAT returns to HMRC</p>
        </div>

        <div class="benefit-highlight">
          <h3>VAT you can claim back from HMRC through quarterly VAT returns</h3>
          <p style="font-size: 24px; margin: 10px 0;"><strong>£${(vatSummary?.vatReclaim || 0).toFixed(2)}</strong></p>
          <p>This is the VAT amount you can claim back through your quarterly VAT return.</p>
          <p><strong>Annual Potential:</strong> £${(vatSummary?.annualBenefit || 0).toFixed(2)} per year</p>
          <p><em>Based on ${vatSummary?.totalItems || 0} VAT-included items only</em></p>
        </div>

        <div class="summary">
          <div class="summary-card">
            <h3>VAT-Included Items</h3>
            <p>${vatSummary?.totalItems || 0}</p>
          </div>
          <div class="summary-card">
            <h3>Total Purchase Cost</h3>
            <p>£${(vatSummary?.totalPurchaseCost || 0).toFixed(2)}</p>
          </div>
          <div class="summary-card">
            <h3>VAT Reclaim Available</h3>
            <p>£${(vatSummary?.vatReclaim || 0).toFixed(2)}</p>
          </div>
          <div class="summary-card">
            <h3>Net Cost After VAT</h3>
            <p>£${(vatSummary?.netCostValue || 0).toFixed(2)}</p>
          </div>
        </div>

        <h3>VAT-Included Purchase Details</h3>
        <table>
          <thead>
            <tr>
              <th>Item Name</th>
              <th>Category</th>
              <th>Qty</th>
              <th>Unit Price (VAT Inc.)</th>
              <th>Purchase Cost</th>
              <th>VAT Reclaim</th>
              <th>Net Cost</th>
            </tr>
          </thead>
          <tbody>
            ${vatIncludedItems.map(item=> {
              const vatPercentage = item.vatPercentage || exportSettings.vatRate;
              const itemCost = item.quantity * item.unitPrice;
              const itemVatReclaim = itemCost * (vatPercentage / (100 + vatPercentage));
              const itemNetCost = itemCost - itemVatReclaim;
              
              return `
              <tr>
                <td>${item.name}</td>
                <td>${item.category || 'Uncategorized'}</td>
                <td class="number">${item.quantity}</td>
                <td class="number">£${item.unitPrice.toFixed(2)}</td>
                <td class="number">£${itemCost.toFixed(2)}</td>
                <td class="number" style="color: #10b981; font-weight: bold;">£${itemVatReclaim.toFixed(2)}</td>
                <td class="number">£${itemNetCost.toFixed(2)}</td>
              </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p><strong>Important:</strong> This report only includes VAT-inclusive purchases. Items without VAT are excluded from calculations.</p>
          <p><strong>VAT reclaims are only available to VAT-registered businesses.</strong> Keep all purchase receipts showing VAT separately for HMRC compliance.</p>
          <p>Generated by Trackio Purchase Tracker. For questions: ${user?.email || 'N/A'}</p>
        </div>
      </body>
      </html>
    `;

    // Create and download HTML file
    const blob=new Blob([htmlContent],{type: 'text/html;charset=utf-8'});
    const link=document.createElement('a');
    const url=URL.createObjectURL(blob);
    link.setAttribute('href',url);
    
    const dateStr=new Date().toISOString().split('T')[0];
    const businessName=(user?.businessName || 'Business').replace(/[^a-zA-Z0-9]/g,'_');
    const fileName=`${businessName}_VAT_Reclaim_Report_${dateStr}.html`;
    
    link.setAttribute('download',fileName);
    link.style.visibility='hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    return fileName;
  };

  const handleExport=async ()=> {
    if (!purchaseData.length) {
      setError('No purchase data to export');
      return;
    }

    //Check if there are any VAT-included items
    const filteredItems = filterItemsByDateRange(purchaseData);
    const vatIncludedItems = filteredItems.filter(item => item.vatIncluded === true);
    
    if (vatIncludedItems.length === 0) {
      setError('No VAT-included items found. Only items with "VAT Included" = Yes can be processed for VAT reclaims.');
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
        totalValue: vatSummary.totalPurchaseCost,
        vatReclaim: vatSummary.vatReclaim,
        dateRange: exportSettings.dateRange === 'all' ? 'All Time' : `${exportSettings.startDate} to ${exportSettings.endDate}`,
        settings: exportSettings
      };
      
      // Success message and close modal
      setTimeout(()=> {
        const message = `VAT reclaim report exported successfully as ${fileName}!\n\nVAT-Included Items: ${vatSummary.totalItems}\nExcluded Items: ${vatSummary.excludedItems || 0}\nVAT Reclaim available: £${vatSummary.vatReclaim.toFixed(2)}\n\nThis file shows VAT you can claim back from HMRC through quarterly VAT returns.`;
        
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
    if (purchaseData.length > 0) {
      calculateVatSummary(purchaseData);
    }
  },[exportSettings,purchaseData]);

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
                <h3 className="text-lg font-medium text-white">
                  VAT Reclaim Calculator
                </h3>
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

              {/* Additional Settings */}
              <div>
                <h4 className="text-white font-medium mb-3">Additional Settings</h4>
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
                  </div>
                </div>
              </div>

              {/* VAT Summary Preview */}
              {vatSummary && (
                <div className="bg-gray-700 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-3">VAT Reclaim Preview</h4>
                  
                  {/* VAT-Included Items Notice */}
                  <div className="bg-yellow-900/20 border-yellow-700 border rounded-lg p-3 mb-4">
                    <div className="flex items-center mb-2">
                      <RiInformationLine className="h-5 w-5 text-yellow-400 mr-2" />
                      <h5 className="text-yellow-400 font-medium">VAT-Included Items Only</h5>
                    </div>
                    <div className="text-sm text-yellow-300">
                      <p>• Processing: <strong>{vatSummary.totalItems}</strong> VAT-included purchases</p>
                      <p>• Excluding: <strong>{vatSummary.excludedItems || 0}</strong> purchases without VAT</p>
                      <p>• Only purchases marked as "VAT Included" are eligible for VAT reclaims</p>
                    </div>
                  </div>
                  
                  <div className="bg-green-900/20 border-green-700 border rounded-lg p-4 mb-4">
                    <div className="flex items-center mb-2">
                      <RiRefund2Line className="h-5 w-5 text-green-400 mr-2" />
                      <h5 className="text-green-400 font-medium">
                        VAT you can claim back from HMRC through quarterly VAT returns
                      </h5>
                    </div>
                    <div className="text-2xl font-bold text-green-400 mb-1">
                      {formatCurrency(vatSummary.vatReclaim)}
                    </div>
                    <div className="text-sm text-green-300 mb-2">
                      Annual: {formatCurrency(vatSummary.annualBenefit)}
                    </div>
                    <div className="text-xs text-green-300">
                      Calculated from VAT-inclusive prices using: VAT = (Price x {exportSettings.vatRate}%) / {100 + exportSettings.vatRate}%
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="bg-gray-800 p-3 rounded">
                      <div className="text-gray-400">VAT Purchases</div>
                      <div className="text-white font-bold text-lg">{vatSummary.totalItems}</div>
                    </div>
                    <div className="bg-gray-800 p-3 rounded">
                      <div className="text-gray-400">Purchase Cost</div>
                      <div className="text-white font-bold text-lg">{formatCurrency(vatSummary.totalPurchaseCost)}</div>
                    </div>
                    <div className="bg-gray-800 p-3 rounded">
                      <div className="text-gray-400">VAT Reclaim</div>
                      <div className="text-green-400 font-bold text-lg">
                        {formatCurrency(vatSummary.vatReclaim)}
                      </div>
                    </div>
                    <div className="bg-gray-800 p-3 rounded">
                      <div className="text-gray-400">Net Cost</div>
                      <div className="text-white font-bold text-lg">{formatCurrency(vatSummary.netCostValue)}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Important Information */}
              <div className="bg-green-900/20 border-green-700 border rounded-lg p-4">
                <div className="flex items-start">
                  <RiInformationLine className="h-5 w-5 text-green-400 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <h5 className="text-green-400 font-medium mb-2">VAT Reclaim Information</h5>
                    <ul className="text-green-300 text-sm space-y-1">
                      <li>• <strong>VAT-Included Purchases Only:</strong> Only processes purchases marked as "VAT Included"</li>
                      <li>• <strong>Accurate Calculations:</strong> Extracts VAT from VAT-inclusive purchase prices</li>
                      <li>• <strong>HMRC Submissions:</strong> Submit quarterly VAT returns to claim reclaims</li>
                      <li>• <strong>Documentation:</strong> Keep all purchase invoices showing VAT separately</li>
                      <li>• <strong>Cash Flow:</strong> VAT reclaims improve your business cash flow</li>
                      <li>• <strong>Deadlines:</strong> Returns due 1 month and 7 days after quarter end</li>
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
                  disabled={isLoading || !purchaseData.length}
                  className="flex items-center px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <RiDownloadLine className="h-4 w-4 mr-2" />
                      Export VAT Reclaim Report
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