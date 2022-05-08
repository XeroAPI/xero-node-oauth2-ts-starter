// generate class for xero lineItems
class LineItem {
  description: string
  unitAmount: number
  constructor(description: string, unitAmount: number) {
    this.description = description;
    this.unitAmount = unitAmount;
  }
}

class Invoice {
  LineItems: LineItem[]
  Type: string
  Contact: string
  DueDate: string
  SubTotal: number
  TotalTax: number
  Total: number
  Status: string
  url: string
  constructor(lineItems: LineItem[], 
              Type: string, 
              Contact: string, 
              DueDate: string, 
              SubTotal: number, 
              TotalTax: number, 
              Total: number, 
              Status: string, 
              url: string) {
    this.LineItems = lineItems;
    this.Type = Type;
    this.Contact = Contact;
    this.DueDate = DueDate;
    this.SubTotal = SubTotal;
    this.TotalTax = TotalTax;
    this.Total = Total;
    this.Status = Status;
    this.url = url;
  }
}