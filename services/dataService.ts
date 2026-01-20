import { Importer } from '../types';

/**
 * Progressive data loading service
 * Loads data in batches for better performance
 */
export class DataService {
  private static readonly INITIAL_BATCH_SIZE = 50;
  private static readonly BATCH_SIZE = 50;

  /**
   * Load initial batch of importers (first 50)
   */
  static async loadInitialImporters(allImporters: Importer[]): Promise<Importer[]> {
    return allImporters.slice(0, this.INITIAL_BATCH_SIZE);
  }

  /**
   * Load next batch of importers
   */
  static async loadNextBatch(
    allImporters: Importer[],
    currentCount: number
  ): Promise<Importer[]> {
    const nextBatch = allImporters.slice(
      currentCount,
      currentCount + this.BATCH_SIZE
    );
    
    // Simulate network delay for realistic loading
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return nextBatch;
  }

  /**
   * Check if there are more items to load
   */
  static hasMore(allImporters: Importer[], currentCount: number): boolean {
    return currentCount < allImporters.length;
  }
}









