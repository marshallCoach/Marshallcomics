export interface BoxComic {
  Box: number;
  Title: string;
  Publisher: string;
  Issue: string;
  Year: string;
  Era: string;
  Writer?: string;
  Artist?: string;
  Key: string;
  Key_Why?: string;
  First_App?: string;
  Platform?: string;
  CGC_Worth?: string;
  Value_NM?: string;
  Notes?: string;
  Terrificon?: string;
}

export const BOX_INVENTORY: BoxComic[] = [
  { Box: 1, Title: "Uncanny X-Men", Publisher: "Marvel", Issue: "141", Year: "1981", Era: "Bronze", Writer: "Chris Claremont", Artist: "John Byrne", Key: "YES", Key_Why: "Days of Future Past Part 1 - 1st Sentinel killing mutants timeline", CGC_Worth: "YES", Value_NM: "$95", Platform: "WHATNOT" },
  { Box: 1, Title: "Uncanny X-Men", Publisher: "Marvel", Issue: "142", Year: "1981", Era: "Bronze", Writer: "Chris Claremont", Artist: "John Byrne", Key: "YES", Key_Why: "Days of Future Past Part 2", CGC_Worth: "YES", Value_NM: "$60", Platform: "WHATNOT" },
  { Box: 1, Title: "Amazing Spider-Man", Publisher: "Marvel", Issue: "252", Year: "1984", Era: "Copper", Writer: "Tom DeFalco", Artist: "Ron Frenz", Key: "YES", Key_Why: "1st appearance of black costume (alien symbiote)", CGC_Worth: "YES", Value_NM: "$200", Platform: "HERITAGE" },
  { Box: 1, Title: "Thor", Publisher: "Marvel", Issue: "337", Year: "1983", Era: "Copper", Writer: "Walt Simonson", Artist: "Walt Simonson", Key: "YES", Key_Why: "1st appearance of Beta Ray Bill", CGC_Worth: "YES", Value_NM: "$120", Platform: "WHATNOT" },
  { Box: 1, Title: "Avengers", Publisher: "Marvel", Issue: "57", Year: "1968", Era: "Silver", Writer: "Roy Thomas", Artist: "John Buscema", Key: "YES", Key_Why: "1st appearance of Vision", CGC_Worth: "YES", Value_NM: "$650", Platform: "HERITAGE" },
  { Box: 1, Title: "Daredevil", Publisher: "Marvel", Issue: "1", Year: "1964", Era: "Silver", Writer: "Stan Lee", Artist: "Bill Everett", Key: "YES", Key_Why: "1st appearance of Daredevil", CGC_Worth: "YES", Value_NM: "$8000", Platform: "HERITAGE" },
  { Box: 2, Title: "Fantastic Four", Publisher: "Marvel", Issue: "48", Year: "1966", Era: "Silver", Writer: "Stan Lee", Artist: "Jack Kirby", Key: "YES", Key_Why: "1st appearance of Silver Surfer and Galactus", CGC_Worth: "YES", Value_NM: "$4500", Platform: "HERITAGE" },
  { Box: 2, Title: "X-Force", Publisher: "Marvel", Issue: "2", Year: "1991", Era: "Modern", Writer: "Rob Liefeld", Artist: "Rob Liefeld", Key: "YES", Key_Why: "1st full appearance of Deadpool (cover)", CGC_Worth: "NO", Value_NM: "$15", Platform: "WHATNOT" },
  { Box: 2, Title: "Green Lantern", Publisher: "DC", Issue: "87", Year: "1971", Era: "Bronze", Writer: "Dennis O'Neil", Artist: "Neal Adams", Key: "YES", Key_Why: "1st appearance of John Stewart", CGC_Worth: "YES", Value_NM: "$350", Platform: "EBAY" },
  { Box: 2, Title: "Batman", Publisher: "DC", Issue: "357", Year: "1983", Era: "Copper", Writer: "Gerry Conway", Artist: "Don Newton", Key: "YES", Key_Why: "1st appearance of Jason Todd (cameo)", CGC_Worth: "YES", Value_NM: "$55", Platform: "WHATNOT" },
  { Box: 2, Title: "Wolverine", Publisher: "Marvel", Issue: "1", Year: "1982", Era: "Copper", Writer: "Chris Claremont", Artist: "Frank Miller", Key: "YES", Key_Why: "1st Wolverine solo series", CGC_Worth: "YES", Value_NM: "$225", Platform: "HERITAGE", Terrificon: "YES" },
  { Box: 3, Title: "Secret Wars", Publisher: "Marvel", Issue: "8", Year: "1985", Era: "Copper", Writer: "Jim Shooter", Artist: "Mike Zeck", Key: "YES", Key_Why: "1st black costume Spider-Man (first in continuity)", CGC_Worth: "YES", Value_NM: "$150", Platform: "WHATNOT" },
  { Box: 3, Title: "Amazing Fantasy", Publisher: "Marvel", Issue: "15", Year: "1962", Era: "Silver", Writer: "Stan Lee", Artist: "Steve Ditko", Key: "YES", Key_Why: "1st appearance of Spider-Man", CGC_Worth: "YES", Value_NM: "$450000", Platform: "HERITAGE" },
  { Box: 3, Title: "Superman", Publisher: "DC", Issue: "75", Year: "1993", Era: "Modern", Writer: "Dan Jurgens", Artist: "Dan Jurgens", Key: "YES", Key_Why: "Death of Superman", CGC_Worth: "NO", Value_NM: "$20", Platform: "EBAY" },
  { Box: 3, Title: "Flash", Publisher: "DC", Issue: "123", Year: "1961", Era: "Silver", Writer: "Gardner Fox", Artist: "Carmine Infantino", Key: "YES", Key_Why: "1st meeting of Earth-1 and Earth-2 Flash, 1st Multiverse story", CGC_Worth: "YES", Value_NM: "$2800", Platform: "HERITAGE" },
  { Box: 4, Title: "Wolverine", Publisher: "Marvel", Issue: "10", Year: "1989", Era: "Copper", Writer: "Chris Claremont", Artist: "John Buscema", Key: "YES", Key_Why: "1st appearance of Bloodscream", CGC_Worth: "NO", Value_NM: "$12", Platform: "WHATNOT" },
  { Box: 4, Title: "Alpha Flight", Publisher: "Marvel", Issue: "33", Year: "1986", Era: "Copper", Writer: "Bill Mantlo", Artist: "Sal Buscema", Key: "YES", Key_Why: "1st appearance of Talisman II", CGC_Worth: "NO", Value_NM: "$8", Platform: "WHATNOT" },
  { Box: 4, Title: "Justice League", Publisher: "DC", Issue: "1", Year: "1987", Era: "Copper", Writer: "Keith Giffen", Artist: "Kevin Maguire", Key: "YES", Key_Why: "Launch of Bwahaha era JLA", CGC_Worth: "NO", Value_NM: "$30", Platform: "EBAY" },
  { Box: 4, Title: "Teenage Mutant Ninja Turtles", Publisher: "IDW", Issue: "1", Year: "2011", Era: "Modern", Writer: "Tom Waltz", Artist: "Dan Duncan", Key: "NO", CGC_Worth: "NO", Value_NM: "$8", Platform: "WHATNOT" },
  { Box: 5, Title: "Batman Adventures", Publisher: "DC", Issue: "12", Year: "1993", Era: "Modern", Writer: "Kelley Puckett", Artist: "Mike Parobeck", Key: "YES", Key_Why: "1st appearance of Harley Quinn in comics (cameo)", CGC_Worth: "YES", Value_NM: "$350", Platform: "HERITAGE", Terrificon: "YES" },
  { Box: 5, Title: "X-Men", Publisher: "Marvel", Issue: "94", Year: "1975", Era: "Bronze", Writer: "Chris Claremont", Artist: "Dave Cockrum", Key: "YES", Key_Why: "First new X-Men (2nd series), departure of original X-Men", CGC_Worth: "YES", Value_NM: "$450", Platform: "HERITAGE" },
  { Box: 5, Title: "Amazing Spider-Man", Publisher: "Marvel", Issue: "129", Year: "1974", Era: "Bronze", Writer: "Gerry Conway", Artist: "Ross Andru", Key: "YES", Key_Why: "1st appearance of Punisher", CGC_Worth: "YES", Value_NM: "$900", Platform: "HERITAGE" },
  { Box: 5, Title: "Strange Tales", Publisher: "Marvel", Issue: "110", Year: "1963", Era: "Silver", Writer: "Stan Lee", Artist: "Steve Ditko", Key: "YES", Key_Why: "1st appearance of Doctor Strange", CGC_Worth: "YES", Value_NM: "$8500", Platform: "HERITAGE" },
  { Box: 6, Title: "Bone", Publisher: "Indie", Issue: "1", Year: "1991", Era: "Modern", Writer: "Jeff Smith", Artist: "Jeff Smith", Key: "YES", Key_Why: "1st appearance, rare self-published first print", CGC_Worth: "YES", Value_NM: "$500", Platform: "EBAY" },
  { Box: 6, Title: "Saga", Publisher: "Image", Issue: "1", Year: "2012", Era: "Modern", Writer: "Brian K. Vaughan", Artist: "Fiona Staples", Key: "YES", Key_Why: "1st appearance of Alana, Marko, and Hazel", CGC_Worth: "YES", Value_NM: "$120", Platform: "WHATNOT" },
  { Box: 6, Title: "Walking Dead", Publisher: "Image", Issue: "1", Year: "2003", Era: "Modern", Writer: "Robert Kirkman", Artist: "Tony Moore", Key: "YES", Key_Why: "1st appearance of Rick Grimes, first print", CGC_Worth: "YES", Value_NM: "$650", Platform: "HERITAGE" },
  { Box: 6, Title: "Preacher", Publisher: "DC", Issue: "1", Year: "1995", Era: "Modern", Writer: "Garth Ennis", Artist: "Steve Dillon", Key: "YES", Key_Why: "1st appearance of Jesse Custer, Cassidy, Tulip", CGC_Worth: "YES", Value_NM: "$85", Platform: "EBAY" },
  { Box: 7, Title: "Iron Man", Publisher: "Marvel", Issue: "128", Year: "1979", Era: "Bronze", Writer: "David Michelinie", Artist: "Bob Layton", Key: "YES", Key_Why: "Demon in a Bottle — landmark story arc conclusion", CGC_Worth: "YES", Value_NM: "$60", Platform: "WHATNOT" },
  { Box: 7, Title: "Captain America", Publisher: "Marvel", Issue: "117", Year: "1969", Era: "Silver", Writer: "Stan Lee", Artist: "Gene Colan", Key: "YES", Key_Why: "1st appearance of Falcon", CGC_Worth: "YES", Value_NM: "$450", Platform: "HERITAGE" },
  { Box: 7, Title: "Avengers", Publisher: "Marvel", Issue: "4", Year: "1964", Era: "Silver", Writer: "Stan Lee", Artist: "Jack Kirby", Key: "YES", Key_Why: "Return of Captain America from ice", CGC_Worth: "YES", Value_NM: "$4200", Platform: "HERITAGE" },
  { Box: 7, Title: "Power Man and Iron Fist", Publisher: "Marvel", Issue: "50", Year: "1978", Era: "Bronze", Writer: "Chris Claremont", Artist: "John Byrne", Key: "YES", Key_Why: "1st Power Man / Iron Fist team (as series)", CGC_Worth: "NO", Value_NM: "$25", Platform: "EBAY" },
  { Box: 8, Title: "Marvel Super Heroes Secret Wars", Publisher: "Marvel", Issue: "1", Year: "1984", Era: "Copper", Writer: "Jim Shooter", Artist: "Mike Zeck", Key: "YES", Key_Why: "First major Marvel crossover event", CGC_Worth: "NO", Value_NM: "$30", Platform: "WHATNOT" },
  { Box: 8, Title: "Crisis on Infinite Earths", Publisher: "DC", Issue: "7", Year: "1986", Era: "Copper", Writer: "Marv Wolfman", Artist: "George Perez", Key: "YES", Key_Why: "Death of Supergirl, landmark DC event", CGC_Worth: "YES", Value_NM: "$95", Platform: "EBAY" },
  { Box: 8, Title: "Crisis on Infinite Earths", Publisher: "DC", Issue: "8", Year: "1985", Era: "Copper", Writer: "Marv Wolfman", Artist: "George Perez", Key: "YES", Key_Why: "Death of the Flash (Barry Allen)", CGC_Worth: "YES", Value_NM: "$55", Platform: "EBAY" },
  { Box: 8, Title: "X-Men", Publisher: "Marvel", Issue: "101", Year: "1976", Era: "Bronze", Writer: "Chris Claremont", Artist: "Dave Cockrum", Key: "YES", Key_Why: "1st appearance of Phoenix (Jean Grey)", CGC_Worth: "YES", Value_NM: "$350", Platform: "HERITAGE" },
  { Box: 9, Title: "Ghost Rider", Publisher: "Marvel", Issue: "1", Year: "1990", Era: "Copper", Writer: "Howard Mackie", Artist: "Javier Saltares", Key: "YES", Key_Why: "1st appearance of Dan Ketch Ghost Rider", CGC_Worth: "NO", Value_NM: "$18", Platform: "WHATNOT" },
  { Box: 9, Title: "Venom: Lethal Protector", Publisher: "Marvel", Issue: "1", Year: "1993", Era: "Modern", Writer: "David Michelinie", Artist: "Mark Bagley", Key: "YES", Key_Why: "1st Venom solo series", CGC_Worth: "NO", Value_NM: "$22", Platform: "WHATNOT" },
  { Box: 9, Title: "Knightfall", Publisher: "DC", Issue: "1", Year: "1993", Era: "Modern", Writer: "Doug Moench", Artist: "Jim Aparo", Key: "YES", Key_Why: "Bane breaks Batman's back", CGC_Worth: "YES", Value_NM: "$35", Platform: "EBAY" },
  { Box: 9, Title: "Marvels", Publisher: "Marvel", Issue: "1", Year: "1994", Era: "Modern", Writer: "Kurt Busiek", Artist: "Alex Ross", Key: "YES", Key_Why: "Alex Ross painted art landmark", CGC_Worth: "NO", Value_NM: "$20", Platform: "WHATNOT" },
  { Box: 9, Title: "Kingdom Come", Publisher: "DC", Issue: "1", Year: "1996", Era: "Modern", Writer: "Mark Waid", Artist: "Alex Ross", Key: "YES", Key_Why: "Alex Ross magnum opus, landmark Elseworlds", CGC_Worth: "NO", Value_NM: "$25", Platform: "WHATNOT" },
];
