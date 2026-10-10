export const SYNTHETIC_W2_TEXT = `Form W-2 Wage and Tax Statement 2025
a Employee's social security number
123-45-6789
b Employer identification number
87-1234567
c Employer's name, address, and ZIP code
Northwind Paper Co
100 Mill Road
Springfield, IL 62701
e Employee's name, address, and ZIP code
Alex Rivera
55 Oak Street
Springfield, IL 62702
1 Wages, tips, other compensation
81234.56
2 Federal income tax withheld
14200.00
3 Social security wages
81234.56
4 Social security tax withheld
5036.54
5 Medicare wages and tips
81234.56
6 Medicare tax withheld
1177.90
10 Dependent care benefits
1200.00
12a DD 3400.00
12b D 2100.00
13 Retirement plan
14 Union dues 350.00
16 State wages, tips, etc.
81234.56
17 State income tax
3200.00
18 Local wages, tips, etc.
81234.56
19 Local income tax
400.00`;

export const SYNTHETIC_W2_EXPECTED = {
	employerName: "Northwind Paper Co",
	employerEin: "87-1234567",
	employeeName: "Alex Rivera",
	employeeSsn: "123-45-6789",
	wages: 81234.56,
	federalWithholding: 14200,
	socialSecurityWages: 81234.56,
	socialSecurityTax: 5036.54,
	medicareWages: 81234.56,
	medicareTax: 1177.9,
	dependentCareBenefits: 1200,
	stateWages: 81234.56,
	stateTax: 3200,
	localWages: 81234.56,
	localTax: 400,
	retirementPlan: true,
	box12: [
		{ code: "DD", amount: 3400 },
		{ code: "D", amount: 2100 },
	],
	box14: [{ label: "Union dues", amount: 350 }],
};
