import rawDb from '../../db/curvedb.json';
import { DatabaseData } from '../types';

export const DB: DatabaseData = rawDb as unknown as DatabaseData;
