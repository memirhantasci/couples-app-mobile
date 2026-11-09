declare module "tz-lookup" {
  /** Enlem/boylamdan IANA saat dilimi adı. Açık denizde `Etc/GMT±N` döner, aralık dışı girdide RangeError atar. */
  function tzlookup(latitude: number, longitude: number): string;
  export = tzlookup;
}
