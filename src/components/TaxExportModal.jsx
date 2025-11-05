import {useState,useEffect} from 'react';
import {motion,AnimatePresence} from 'framer-motion';
import {RiCloseLine,RiDownloadLine,RiFileTextLine,RiFileExcelLine,RiCalendarLine,RiMoneyDollarCircleLine,RiCalculatorLine,RiCheckLine,RiAlertLine,RiInformationLine,RiRefund2Line,RiReceiptLine} from 'react-icons/ri';
import * as XLSX from 'xlsx';
import {getInventoryItems} from '../services/db';
import {useAuth} from '../context/AuthContext';

const formatCurrency=(value)=> {
  return `£${(value || 0).toFixed(2)}`;
};

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
    vatRegistered: true, // This will determine the calculation method
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
    
    // Calculate total based on VAT fields if available, fallback to unitPrice
    const totalPurchaseCost=filteredItems.reduce((sum,item)=> {
      // Use VAT-inclusive price from database if available, otherwise use unitPrice
      const itemPrice = item.vatIncluded ? item.unitPrice : (item.unitPrice * (1 + (item.vatPercentage || 20) / 100));
      return sum + (item.quantity * itemPrice);
    }, 0);
    
    let taxBenefit = 0;
    let netCostValue = 0;
    let benefitType = '';
    let benefitDescription = '';
    
    if (exportSettings.vatRegistered) {
      // VAT Registered: Calculate VAT refund from VAT-inclusive prices
      taxBenefit = filteredItems.reduce((sum, item) => {
        const vatPercentage = item.vatPercentage || exportSettings.vatRate;
        let itemVatRefund = 0;
        
        if (item.vatIncluded) {
          // Price includes VAT - extract VAT amount
          const itemCost = item.quantity * item.unitPrice;
          itemVatRefund = itemCost * (vatPercentage / (100 + vatPercentage));
        } else {
          // Price excludes VAT - calculate VAT that would be added
          const itemCost = item.quantity * item.unitPrice;
          itemVatRefund = itemCost * (vatPercentage / 100);
        }
        
        return sum + itemVatRefund;
      }, 0);
      
      netCostValue = totalPurchaseCost - taxBenefit;
      benefitType = 'VAT Refund';
      benefitDescription = 'VAT you can claim back from HMRC through quarterly VAT returns';
    } else {
      // Not VAT Registered: Calculate tax relief on VAT-inclusive items
      taxBenefit = filteredItems.reduce((sum, item) => {
        const vatPercentage = item.vatPercentage || exportSettings.vatRate;
        let taxReliefAmount = 0;
        
        if (item.vatIncluded) {
          // Can claim tax relief on the VAT portion for business expenses
          const itemCost = item.quantity * item.unitPrice;
          const vatAmount = itemCost * (vatPercentage / (100 + vatPercentage));
          // Tax relief on VAT at corporation tax rate (19% for small companies, 25% for large)
          taxReliefAmount = vatAmount * 0.19; // Assuming small company rate
        }
        
        return sum + taxReliefAmount;
      }, 0);
      
      netCostValue = totalPurchaseCost - taxBenefit;
      benefitType = 'Tax Relief';
      benefitDescription = 'Tax relief on business expenses (including VAT portion) through Corporation Tax or Self Assessment';
    }
    
    const categoryBreakdown=filteredItems.reduce((acc,item)=> {
      const category=item.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category]={
          items: 0,
          quantity: 0,
          totalCost: 0,
          taxBenefit: 0,
          netCost: 0
        };
      }
      
      const vatPercentage = item.vatPercentage || exportSettings.vatRate;
      const itemPrice = item.vatIncluded ? item.unitPrice : (item.unitPrice * (1 + vatPercentage / 100));
      const itemCost = item.quantity * itemPrice;
      let itemTaxBenefit = 0;
      
      if (exportSettings.vatRegistered) {
        // VAT refund calculation
        if (item.vatIncluded) {
          itemTaxBenefit = itemCost * (vatPercentage / (100 + vatPercentage));
        } else {
          itemTaxBenefit = (item.quantity * item.unitPrice) * (vatPercentage / 100);
        }
      } else {
        // Tax relief calculation
        if (item.vatIncluded) {
          const vatAmount = itemCost * (vatPercentage / (100 + vatPercentage));
          itemTaxBenefit = vatAmount * 0.19; // Corporation tax relief
        }
      }
      
      const itemNetCost = itemCost - itemTaxBenefit;
      
      acc[category].items++;
      acc[category].quantity += item.quantity;
      acc[category].totalCost += itemCost;
      acc[category].taxBenefit += itemTaxBenefit;
      acc[category].netCost += itemNetCost;
      
      return acc;
    },{});

    // Calculate potential quarterly and annual benefits
    const quarterlyBenefit = taxBenefit / 4;
    const annualBenefit = taxBenefit;

    setTaxSummary({
      totalItems: filteredItems.length,
      totalQuantity: filteredItems.reduce((sum,item)=> sum + item.quantity,0),
      totalPurchaseCost,
      taxBenefit,
      netCostValue,
      quarterlyBenefit,
      annualBenefit,
      categoryBreakdown,
      averageBenefitPerItem: filteredItems.length > 0 ? taxBenefit / filteredItems.length : 0,
      benefitPercentage: totalPurchaseCost > 0 ? (taxBenefit / totalPurchaseCost) * 100 : 0,
      benefitType,
      benefitDescription,
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
      const categoryData=Object.entries(taxSummary.categoryBreakdown).map(([category,data])=> ({
        'Category': category,
        'Total Items': data.items,
        'Total Quantity': data.quantity,
        'Total Purchase Cost': data.totalCost.toFixed(2),
        [`${taxSummary.benefitType} Available`]: data.taxBenefit.toFixed(2),
        'Net Cost After Benefit': data.netCost.toFixed(2),
        [`Average ${taxSummary.benefitType} per Item`]: (data.items > 0 ? data.taxBenefit / data.items : 0).toFixed(2)
      }));
      
      reportData=categoryData;
    } else {
      // Full detailed report
      reportData=filteredItems.map(item=> {
        const vatPercentage = item.vatPercentage || exportSettings.vatRate;
        const itemPrice = item.vatIncluded ? item.unitPrice : (item.unitPrice * (1 + vatPercentage / 100));
        const itemCost = item.quantity * itemPrice;
        let itemTaxBenefit = 0;
        
        if (exportSettings.vatRegistered) {
          // VAT refund calculation
          if (item.vatIncluded) {
            itemTaxBenefit = itemCost * (vatPercentage / (100 + vatPercentage));
          } else {
            itemTaxBenefit = (item.quantity * item.unitPrice) * (vatPercentage / 100);
          }
        } else {
          // Tax relief calculation
          if (item.vatIncluded) {
            const vatAmount = itemCost * (vatPercentage / (100 + vatPercentage));
            itemTaxBenefit = vatAmount * 0.19;
          }
        }
        
        const itemNetCost = itemCost - itemTaxBenefit;
        
        return {
          'Item Name': item.name,
          'Category': item.category || 'Uncategorized',
          'Quantity': item.quantity,
          'Unit Price': item.unitPrice.toFixed(2),
          'VAT Included': item.vatIncluded ? 'Yes' : 'No',
          'VAT Rate': `${item.vatPercentage || exportSettings.vatRate}%`,
          'Total Purchase Cost': itemCost.toFixed(2),
          [`${taxSummary.benefitType} Available`]: itemTaxBenefit.toFixed(2),
          'Net Cost After Benefit': itemNetCost.toFixed(2),
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
    XLSX.utils.book_append_sheet(wb,ws,exportSettings.reportType === 'summary' ? 'Category Summary' : `${taxSummary.benefitType} Details`);

    // Tax summary sheet
    const summaryTitle = exportSettings.vatRegistered ? 'VAT REFUND REPORT' : 'TAX RELIEF REPORT';
    const calculationMethod = exportSettings.vatRegistered 
      ? 'VAT extracted from purchase prices for HMRC refund claims'
      : 'Tax relief calculated on business expenses including VAT portion';
    
    const taxSummaryData=[
      [summaryTitle,''],
      ['Generated on:',new Date().toLocaleDateString('en-GB')],
      ['Business Name:',user?.businessName || ''],
      ['Export Period:',exportSettings.dateRange === 'all' ? 'All Time' : `${exportSettings.startDate} to ${exportSettings.endDate}`],
      ['VAT Registration Status:',exportSettings.vatRegistered ? 'VAT Registered' : 'Not VAT Registered'],
      ['',''],
      [`${taxSummary.benefitType.toUpperCase()} SUMMARY`,''],
      ['Total Items:',taxSummary.totalItems],
      ['Total Quantity:',taxSummary.totalQuantity],
      ['Total Purchase Cost:',taxSummary.totalPurchaseCost.toFixed(2)],
      ['VAT Rate Used:',`${exportSettings.vatRate}%`],
      [`${taxSummary.benefitType} Available:`,taxSummary.taxBenefit.toFixed(2)],
      ['Net Cost After Benefit:',taxSummary.netCostValue.toFixed(2)],
      [`Average ${taxSummary.benefitType} per Item:`,taxSummary.averageBenefitPerItem.toFixed(2)],
      ['',''],
      ['CALCULATION METHOD',''],
      ['Description:',calculationMethod],
      ...(exportSettings.vatRegistered ? [
        ['VAT Refund Formula:','VAT = (Purchase Price × VAT%) ÷ (100 + VAT%)'],
        ['Example:','£120.00 purchase = (£120.00 × 20) ÷ 120 = £20.00 VAT refund'],
        ['How to Claim:','Submit quarterly VAT returns to HMRC'],
        ['Requirements:','Must be VAT registered with HMRC']
      ] : [
        ['Tax Relief Method:','Corporation Tax relief on business expenses'],
        ['Relief Rate:','19% (small companies) or 25% (large companies)'],
        ['Example:','£20.00 VAT portion × 19% = £3.80 tax relief'],
        ['How to Claim:','Include in Corporation Tax return or Self Assessment'],
        ['Requirements:','Valid business expenses with receipts']
      ]),
      ['',''],
      ['CATEGORY BREAKDOWN','']
    ];

    // Add category breakdown
    Object.entries(taxSummary.categoryBreakdown).forEach(([category,data])=> {
      taxSummaryData.push([
        category,
        `${data.items} items`,
        `Cost: ${data.totalCost.toFixed(2)}`,
        `${taxSummary.benefitType}: ${data.taxBenefit.toFixed(2)}`
      ]);
    });

    const taxWs=XLSX.utils.aoa_to_sheet(taxSummaryData);
    XLSX.utils.book_append_sheet(wb,taxWs,`${taxSummary.benefitType} Summary`);

    // Accountant notes sheet
    const notesTitle = exportSettings.vatRegistered ? 'VAT REFUND REPORT - ACCOUNTANT NOTES' : 'TAX RELIEF REPORT - ACCOUNTANT NOTES';
    const notesData=[
      [notesTitle,''],
      ['',''],
      ['REPORT DETAILS',''],
      ['Report Generated:',new Date().toLocaleString('en-GB')],
      ['Generated By:',user?.businessName || ''],
      ['Email:',user?.email || ''],
      ['System:','Trackio Inventory Management'],
      ['VAT Registration:',exportSettings.vatRegistered ? 'VAT Registered Business' : 'Not VAT Registered'],
      ['',''],
      ...(exportSettings.vatRegistered ? [
        ['VAT REFUND CALCULATION METHOD',''],
        ['Calculation Type:','VAT extraction from purchase prices'],
        ['VAT Rate Used:',`${exportSettings.vatRate}% (UK Standard Rate)`],
        ['Formula:','VAT Amount = (Purchase Price × VAT Rate) ÷ (100 + VAT Rate)'],
        ['Example:','£120.00 purchase = (£120.00 × 20) ÷ 120 = £20.00 VAT refund'],
        ['Net Cost:','Purchase Price - VAT Amount'],
        ['',''],
        ['HOW TO CLAIM VAT REFUNDS',''],
        ['1. VAT Registration:','Business must be registered for VAT with HMRC'],
        ['2. Quarterly Returns:','Submit VAT returns quarterly online'],
        ['3. Documentation:','Keep all purchase invoices showing VAT separately'],
        ['4. Deadlines:','Submit by 1 month and 7 days after quarter end'],
        ['5. Cash Flow:','VAT refunds improve business cash flow'],
        ['6. Compliance:','Maintain VAT records for 6 years minimum']
      ] : [
        ['TAX RELIEF CALCULATION METHOD',''],
        ['Relief Type:','Corporation Tax relief on business expenses'],
        ['Relief Rate:','19% (small companies) or 25% (large companies)'],
        ['VAT Treatment:','Tax relief available on VAT portion of expenses'],
        ['Formula:','Tax Relief = VAT Amount × Corporation Tax Rate'],
        ['Example:','£20.00 VAT × 19% = £3.80 tax relief'],
        ['',''],
        ['HOW TO CLAIM TAX RELIEF',''],
        ['1. Business Expenses:','All items must be legitimate business expenses'],
        ['2. Documentation:','Keep all receipts and invoices'],
        ['3. Corporation Tax:','Include in annual Corporation Tax return'],
        ['4. Self Assessment:','Include if sole trader or partnership'],
        ['5. VAT Consideration:','Cannot register for VAT and claim this relief'],
        ['6. Professional Advice:','Consider VAT registration if turnover increasing']
      ]),
      ['',''],
      ['IMPORTANT CONSIDERATIONS',''],
      ...(exportSettings.vatRegistered ? [
        ['VAT Registration:','Only VAT registered businesses can claim VAT refunds'],
        ['Purchase Documentation:','Ensure invoices show VAT separately'],
        ['Quarterly Submission:','Must submit returns even if no VAT due'],
        ['Penalties:','Late submission incurs automatic penalties'],
        ['Record Keeping:','Digital records acceptable, keep for 6 years']
      ] : [
        ['VAT Registration Threshold:',`£85,000 annual turnover (2024)`],
        ['Voluntary Registration:','Can register below threshold to claim VAT'],
        ['Cost-Benefit Analysis:','Compare tax relief vs. VAT refund potential'],
        ['Future Planning:','Consider VAT registration as business grows'],
        ['Professional Advice:','Consult accountant for VAT registration decision']
      ]),
      ['',''],
      ['EXPORT SETTINGS USED',''],
      ['Include Zero Value Items:',exportSettings.includeZeroValue ? 'Yes' : 'No'],
      ['Include Out of Stock:',exportSettings.includeOutOfStock ? 'Yes' : 'No'],
      ['Group by Category:',exportSettings.groupByCategory ? 'Yes' : 'No'],
      ['VAT Registration Status:',exportSettings.vatRegistered ? 'VAT Registered' : 'Not VAT Registered'],
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
    const excelReportType = exportSettings.vatRegistered ? 'VAT_Refund' : 'Tax_Relief';
    const fileName=`${businessName}_${excelReportType}_Report_${dateStr}.xlsx`;

    // Download file
    XLSX.writeFile(wb,fileName);
    
    return fileName;
  };

  const generateCSVReport=()=> {
    const filteredItems=filterItemsByDateRange(inventoryData);
    
    const csvData=filteredItems.map(item=> {
      const vatPercentage = item.vatPercentage || exportSettings.vatRate;
      const itemPrice = item.vatIncluded ? item.unitPrice : (item.unitPrice * (1 + vatPercentage / 100));
      const itemCost = item.quantity * itemPrice;
      let itemTaxBenefit = 0;
      
      if (exportSettings.vatRegistered) {
        if (item.vatIncluded) {
          itemTaxBenefit = itemCost * (vatPercentage / (100 + vatPercentage));
        } else {
          itemTaxBenefit = (item.quantity * item.unitPrice) * (vatPercentage / 100);
        }
      } else {
        if (item.vatIncluded) {
          const vatAmount = itemCost * (vatPercentage / (100 + vatPercentage));
          itemTaxBenefit = vatAmount * 0.19;
        }
      }
      
      const itemNetCost = itemCost - itemTaxBenefit;
      
      return {
        'Item Name': item.name,
        'Category': item.category || 'Uncategorized',
        'Quantity': item.quantity,
        'Unit Price': item.unitPrice.toFixed(2),
        'VAT Included': item.vatIncluded ? 'Yes' : 'No',
        'VAT Rate': `${vatPercentage}%`,
        'Total Purchase Cost': itemCost.toFixed(2),
        [`${taxSummary.benefitType} Available`]: itemTaxBenefit.toFixed(2),
        'Net Cost After Benefit': itemNetCost.toFixed(2),
        'Status': item.status,
        'Date Added': item.dateAdded,
        'Description': item.description || '',
        'SKU': item.id || ''
      };
    });

    // Convert to CSV
    const headers=Object.keys(csvData[0] || {});
    const csvReportType = exportSettings.vatRegistered ? 'VAT Refund' : 'Tax Relief';
    const csvContent=[
      // Header with business info
      `${csvReportType} Report - ${user?.businessName || 'Business'}`,
      `Generated: ${new Date().toLocaleString('en-GB')}`,
      `Period: ${exportSettings.dateRange === 'all' ? 'All Time' : `${exportSettings.startDate} to ${exportSettings.endDate}`}`,
      `VAT Rate: ${exportSettings.vatRate}%`,
      `VAT Registration Status: ${exportSettings.vatRegistered ? 'VAT Registered' : 'Not VAT Registered'}`,
      `Calculation Method: ${taxSummary.benefitDescription}`,
      `Total ${csvReportType} Available: ${taxSummary?.taxBenefit?.toFixed(2) || '0.00'}`,
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
    const csvFileReportType = exportSettings.vatRegistered ? 'VAT_Refund' : 'Tax_Relief';
    const fileName=`${businessName}_${csvFileReportType}_Report_${dateStr}.csv`;
    
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
    const pdfReportType = exportSettings.vatRegistered ? 'VAT Refund' : 'Tax Relief';
    
    const htmlContent=`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${pdfReportType} Report - ${user?.businessName || 'Business'}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
          .business-info { background: #f5f5f5; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
          .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
          .summary-card { background: #f9f9f9; padding: 15px; border-left: 4px solid #10b981; }
          .summary-card h3 { margin: 0 0 5px 0; color: #10b981; }
          .summary-card p { margin: 0; font-size: 18px; font-weight: bold; }
          .benefit-highlight { background: ${exportSettings.vatRegistered ? '#dcfce7' : '#dbeafe'}; border: 2px solid ${exportSettings.vatRegistered ? '#10b981' : '#60a5fa'}; padding: 15px; border-radius: 8px; margin: 20px 0; }
          .benefit-highlight h3 { color: ${exportSettings.vatRegistered ? '#047857' : '#1d4ed8'}; margin: 0 0 10px 0; }
          .calculation-info { background: #dbeafe; border: 1px solid #60a5fa; padding: 15px; margin: 20px 0; border-radius: 5px; }
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
          <h1>${pdfReportType} Report</h1>
          <h2>${user?.businessName || 'Business Name'}</h2>
          <p>Generated on ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB')}</p>
        </div>
        
        <div class="business-info">
          <h3>Business Information</h3>
          <p><strong>Business Name:</strong> ${user?.businessName || 'N/A'}</p>
          <p><strong>Email:</strong> ${user?.email || 'N/A'}</p>
          <p><strong>Report Period:</strong> ${exportSettings.dateRange === 'all' ? 'All Time' : `${exportSettings.startDate} to ${exportSettings.endDate}`}</p>
          <p><strong>VAT Registration Status:</strong> ${exportSettings.vatRegistered ? 'VAT Registered' : 'Not VAT Registered'}</p>
          <p><strong>Export Date:</strong> ${new Date().toLocaleDateString('en-GB')}</p>
        </div>

        <div class="calculation-info">
          <h3>${pdfReportType} Calculation Method</h3>
          ${exportSettings.vatRegistered ? `
            <p><strong>Method:</strong> VAT extraction from purchase prices for HMRC refund claims</p>
            <p><strong>Formula:</strong> VAT Amount = (Purchase Price × ${exportSettings.vatRate}%) ÷ ${100 + exportSettings.vatRate}%</p>
            <p><strong>Example:</strong> £120.00 purchase price = (£120.00 × 20) ÷ 120 = £20.00 VAT refund</p>
            <p><strong>How to Claim:</strong> Submit quarterly VAT returns to HMRC</p>
          ` : `
            <p><strong>Method:</strong> Corporation Tax relief on business expenses including VAT portion</p>
            <p><strong>Relief Rate:</strong> 19% (small companies) or 25% (large companies)</p>
            <p><strong>Example:</strong> £20.00 VAT portion × 19% = £3.80 tax relief</p>
            <p><strong>How to Claim:</strong> Include in Corporation Tax return or Self Assessment</p>
          `}
        </div>

        <div class="benefit-highlight">
          <h3>${taxSummary.benefitDescription}</h3>
          <p style="font-size: 24px; margin: 10px 0;"><strong>${formatCurrency(taxSummary?.taxBenefit || 0)}</strong></p>
          <p>${exportSettings.vatRegistered 
            ? 'This is the VAT amount you can claim back through your quarterly VAT return.' 
            : 'This is the tax relief you can claim on business expenses through your tax return.'
          }</p>
          <p><strong>Annual Potential:</strong> ${formatCurrency(taxSummary?.annualBenefit || 0)} per year</p>
        </div>

        ${!exportSettings.vatRegistered ? `
        <div class="notice">
          <strong>VAT Registration Consideration:</strong> If your annual turnover exceeds £85,000, you must register for VAT. 
          Consider voluntary VAT registration to claim full VAT refunds instead of limited tax relief.
        </div>
        ` : ''}

        <div class="summary">
          <div class="summary-card">
            <h3>Total Items</h3>
            <p>${taxSummary?.totalItems || 0}</p>
          </div>
          <div class="summary-card">
            <h3>Total Purchase Cost</h3>
            <p>${formatCurrency(taxSummary?.totalPurchaseCost || 0)}</p>
          </div>
          <div class="summary-card">
            <h3>${taxSummary.benefitType} Available</h3>
            <p>${formatCurrency(taxSummary?.taxBenefit || 0)}</p>
          </div>
          <div class="summary-card">
            <h3>Net Cost After Benefit</h3>
            <p>${formatCurrency(taxSummary?.netCostValue || 0)}</p>
          </div>
        </div>

        <h3>Inventory Details with ${taxSummary.benefitType}</h3>
        <table>
          <thead>
            <tr>
              <th>Item Name</th>
              <th>Category</th>
              <th>Qty</th>
              <th>VAT Inc.</th>
              <th>Purchase Cost</th>
              <th>${taxSummary.benefitType}</th>
              <th>Net Cost</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${filteredItems.map(item=> {
              const vatPercentage = item.vatPercentage || exportSettings.vatRate;
              const itemPrice = item.vatIncluded ? item.unitPrice : (item.unitPrice * (1 + vatPercentage / 100));
              const itemCost = item.quantity * itemPrice;
              let itemTaxBenefit = 0;
              
              if (exportSettings.vatRegistered) {
                if (item.vatIncluded) {
                  itemTaxBenefit = itemCost * (vatPercentage / (100 + vatPercentage));
                } else {
                  itemTaxBenefit = (item.quantity * item.unitPrice) * (vatPercentage / 100);
                }
              } else {
                if (item.vatIncluded) {
                  const vatAmount = itemCost * (vatPercentage / (100 + vatPercentage));
                  itemTaxBenefit = vatAmount * 0.19;
                }
              }
              
              const itemNetCost = itemCost - itemTaxBenefit;
              
              return `
              <tr>
                <td>${item.name}</td>
                <td>${item.category || 'Uncategorized'}</td>
                <td class="number">${item.quantity}</td>
                <td>${item.vatIncluded ? 'Yes' : 'No'}</td>
                <td class="number">${formatCurrency(itemCost)}</td>
                <td class="number" style="color: ${exportSettings.vatRegistered ? '#10b981' : '#1d4ed8'}; font-weight: bold;">${formatCurrency(itemTaxBenefit)}</td>
                <td class="number">${formatCurrency(itemNetCost)}</td>
                <td>${item.status}</td>
              </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p><strong>Important:</strong> ${exportSettings.vatRegistered 
            ? `VAT refunds are only available to VAT-registered businesses. Keep all purchase receipts showing VAT separately for HMRC compliance.`
            : `Tax relief is available on legitimate business expenses. Consider VAT registration if your turnover is increasing.`
          }</p>
          <p>Generated by Trackio Inventory Management System. For questions: ${user?.email || 'N/A'}</p>
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
    const pdfFileReportType = exportSettings.vatRegistered ? 'VAT_Refund' : 'Tax_Relief';
    const fileName=`${businessName}_${pdfFileReportType}_Report_${dateStr}.html`;
    
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
        totalValue: taxSummary.totalPurchaseCost,
        taxBenefit: taxSummary.taxBenefit,
        benefitType: taxSummary.benefitType,
        dateRange: exportSettings.dateRange === 'all' ? 'All Time' : `${exportSettings.startDate} to ${exportSettings.endDate}`,
        settings: exportSettings
      };
      
      // Success message and close modal
      setTimeout(()=> {
        const message = exportSettings.vatRegistered 
          ? `VAT refund report exported successfully as ${fileName}!\n\n${taxSummary.benefitType} available: ${formatCurrency(taxSummary.taxBenefit)}\n\nThis file shows VAT you can claim back from HMRC through quarterly VAT returns.`
          : `Tax relief report exported successfully as ${fileName}!\n\n${taxSummary.benefitType} available: ${formatCurrency(taxSummary.taxBenefit)}\n\nThis file shows tax relief you can claim on business expenses through your tax return.`;
        
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
                {exportSettings.vatRegistered ? (
                  <RiRefund2Line className="h-6 w-6 text-green-400 mr-2" />
                ) : (
                  <RiReceiptLine className="h-6 w-6 text-blue-400 mr-2" />
                )}
                <h3 className="text-lg font-medium text-white">
                  {exportSettings.vatRegistered ? 'VAT Refund Calculator' : 'Tax Relief Calculator'}
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
              {/* VAT Registration Status Selection */}
              <div>
                <h4 className="text-white font-medium mb-3">VAT Registration Status</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div
                    onClick={()=> setExportSettings(prev=> ({...prev,vatRegistered: true}))}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      exportSettings.vatRegistered
                        ? 'border-green-500 bg-green-500/10'
                        : 'border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center mb-2">
                      <RiRefund2Line className="h-6 w-6 text-green-400 mr-2" />
                      <h5 className="text-white font-medium">VAT Registered</h5>
                    </div>
                    <p className="text-gray-400 text-sm mb-2">
                      Calculate VAT refunds you can claim back from HMRC
                    </p>
                    <ul className="text-xs text-gray-500 space-y-1">
                      <li>• Extract VAT from purchase prices</li>
                      <li>• Submit quarterly VAT returns</li>
                      <li>• Get full VAT refund on business expenses</li>
                    </ul>
                  </div>

                  <div
                    onClick={()=> setExportSettings(prev=> ({...prev,vatRegistered: false}))}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      !exportSettings.vatRegistered
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center mb-2">
                      <RiReceiptLine className="h-6 w-6 text-blue-400 mr-2" />
                      <h5 className="text-white font-medium">Not VAT Registered</h5>
                    </div>
                    <p className="text-gray-400 text-sm mb-2">
                      Calculate tax relief on business expenses including VAT
                    </p>
                    <ul className="text-xs text-gray-500 space-y-1">
                      <li>• Corporation Tax relief on expenses</li>
                      <li>• Include VAT portion in business costs</li>
                      <li>• Consider VAT registration if growing</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Export Format Selection */}
              <div>
                <h4 className="text-white font-medium mb-3">Export Format</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    {
                      value: 'excel',
                      label: 'Excel Workbook',
                      description: `Multi-sheet Excel file with detailed ${exportSettings.vatRegistered ? 'VAT' : 'tax relief'} calculations`,
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
                  </div>
                </div>
              </div>

              {/* Tax Summary Preview */}
              {taxSummary && (
                <div className="bg-gray-700 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-3">
                    {exportSettings.vatRegistered ? 'VAT Refund Preview' : 'Tax Relief Preview'}
                  </h4>
                  
                  <div className={`${exportSettings.vatRegistered ? 'bg-green-900/20 border-green-700' : 'bg-blue-900/20 border-blue-700'} border rounded-lg p-4 mb-4`}>
                    <div className="flex items-center mb-2">
                      {exportSettings.vatRegistered ? (
                        <RiRefund2Line className="h-5 w-5 text-green-400 mr-2" />
                      ) : (
                        <RiReceiptLine className="h-5 w-5 text-blue-400 mr-2" />
                      )}
                      <h5 className={`${exportSettings.vatRegistered ? 'text-green-400' : 'text-blue-400'} font-medium`}>
                        {taxSummary.benefitDescription}
                      </h5>
                    </div>
                    <div className={`text-2xl font-bold ${exportSettings.vatRegistered ? 'text-green-400' : 'text-blue-400'} mb-1`}>
                      {formatCurrency(taxSummary.taxBenefit)}
                    </div>
                    <div className={`text-sm ${exportSettings.vatRegistered ? 'text-green-300' : 'text-blue-300'} mb-2`}>
                      Annual: {formatCurrency(taxSummary.annualBenefit)}
                    </div>
                    <div className={`text-xs ${exportSettings.vatRegistered ? 'text-green-300' : 'text-blue-300'}`}>
                      {exportSettings.vatRegistered 
                        ? `Calculated from purchase prices using: VAT = (Price × ${exportSettings.vatRate}%) ÷ ${100 + exportSettings.vatRate}%`
                        : `Tax relief calculated at 19% corporation tax rate on VAT portion of expenses`
                      }
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="bg-gray-800 p-3 rounded">
                      <div className="text-gray-400">Items</div>
                      <div className="text-white font-bold text-lg">{taxSummary.totalItems}</div>
                    </div>
                    <div className="bg-gray-800 p-3 rounded">
                      <div className="text-gray-400">Purchase Cost</div>
                      <div className="text-white font-bold text-lg">{formatCurrency(taxSummary.totalPurchaseCost)}</div>
                    </div>
                    <div className="bg-gray-800 p-3 rounded">
                      <div className="text-gray-400">{taxSummary.benefitType}</div>
                      <div className={`${exportSettings.vatRegistered ? 'text-green-400' : 'text-blue-400'} font-bold text-lg`}>
                        {formatCurrency(taxSummary.taxBenefit)}
                      </div>
                    </div>
                    <div className="bg-gray-800 p-3 rounded">
                      <div className="text-gray-400">Net Cost</div>
                      <div className="text-white font-bold text-lg">{formatCurrency(taxSummary.netCostValue)}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Important Information */}
              <div className={`${exportSettings.vatRegistered ? 'bg-green-900/20 border-green-700' : 'bg-blue-900/20 border-blue-700'} border rounded-lg p-4`}>
                <div className="flex items-start">
                  <RiInformationLine className={`h-5 w-5 ${exportSettings.vatRegistered ? 'text-green-400' : 'text-blue-400'} mr-3 mt-0.5 flex-shrink-0`} />
                  <div>
                    <h5 className={`${exportSettings.vatRegistered ? 'text-green-400' : 'text-blue-400'} font-medium mb-2`}>
                      {exportSettings.vatRegistered ? 'VAT Refund Information' : 'Tax Relief Information'}
                    </h5>
                    <ul className={`${exportSettings.vatRegistered ? 'text-green-300' : 'text-blue-300'} text-sm space-y-1`}>
                      {exportSettings.vatRegistered ? (
                        <>
                          <li>• Calculates VAT from your inventory purchase prices</li>
                          <li>• Submit quarterly VAT returns to HMRC to claim refunds</li>
                          <li>• Keep all purchase invoices showing VAT separately</li>
                          <li>• VAT refunds improve your business cash flow</li>
                          <li>• Returns due 1 month and 7 days after quarter end</li>
                        </>
                      ) : (
                        <>
                          <li>• Tax relief available on legitimate business expenses</li>
                          <li>• Include VAT portion of purchases in expense claims</li>
                          <li>• Corporation tax relief at 19% (small) or 25% (large companies)</li>
                          <li>• Consider VAT registration if turnover exceeds £85,000</li>
                          <li>• Keep all receipts for tax compliance</li>
                        </>
                      )}
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
                  className={`flex items-center px-6 py-2 ${exportSettings.vatRegistered ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <RiDownloadLine className="h-4 w-4 mr-2" />
                      Export {exportSettings.vatRegistered ? 'VAT Refund' : 'Tax Relief'} Report
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