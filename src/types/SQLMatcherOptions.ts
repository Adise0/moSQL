interface SQLMatcherOptions {
  /**
   * Whether to match againts any values intead of all
   */
  useOr?: boolean;

  /**
   * Whether to treat the dates as inclusive
   */
  useInclusive?: boolean;
}

export interface SQLMatcherOperators {
  /**
   * The $in operator checks all values inside the provided array
   */
  $in?: any[];
  /**
   * The matchString partially matches the provided string againt's the whole DB value
   */
  $matchString?: string;
  /**
   * The matchNumber partially matches the provided number againt's the whole DB value
   */
  $matchNumber?: number;

  /**
   * Matches any string in the provided array, like combining `$in` and `$matchString`
   */
  $inMatch?: string[];

  $after?: Date;
  $before?: Date;
  $inYear?: number;
}

/**
 * A matcher partial object that also allows arrays as a value
 * TODO: Change the array to be an object with $in or something just in case
 */
export type SQLMatchers<Schema> = {
  [Key in keyof Schema]?: Schema[Key] | SQLMatcherOperators;
};

export default SQLMatcherOptions;
