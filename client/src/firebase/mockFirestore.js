import { api } from '../services/api';

// Database object placeholder
export const db = {};

// Helper to clean up arguments
function cleanParts(args) {
  return args
    .filter(a => typeof a === 'string')
    .map(a => a.trim())
    .filter(Boolean);
}

// 1. Reference Creators
export function doc(...args) {
  const parts = cleanParts(args);
  const path = parts.join('/');
  const id = parts[parts.length - 1] || '';
  const parentCollection = parts.slice(0, -1).join('/');

  return {
    type: 'doc',
    path,
    id,
    parentCollection
  };
}

export function collection(...args) {
  const parts = cleanParts(args);
  const path = parts.join('/');
  const id = parts[parts.length - 1] || '';

  return {
    type: 'collection',
    path,
    id
  };
}

// 2. Query Constraints
export function query(ref, ...constraints) {
  return {
    type: 'query',
    ref: ref.ref ? ref.ref : ref,
    constraints: [...(ref.constraints || []), ...constraints]
  };
}

export function where(field, op, val) {
  return { type: 'where', field, op, val };
}

export function orderBy(field, direction = 'asc') {
  return { type: 'orderBy', field, direction };
}

export function limit(n) {
  return { type: 'limit', limit: n };
}

export function writeBatch() {
  return {
    commit: async () => {
      console.log('Batch commit mocked successfully.');
    }
  };
}

// 3. Document Retrieval
export async function getDoc(docRef) {
  if (!docRef || !docRef.path) {
    return { exists: () => false, data: () => null, id: '' };
  }

  const parts = docRef.path.split('/');
  let data = null;

  try {
    if (parts[0] === 'schools' && parts.length === 2) {
      data = await api.get(`/schools/${parts[1]}`);
    } else if (parts[0] === 'schools' && parts.length >= 4) {
      const schoolId = parts[1];
      const collectionName = parts[2];
      const docId = parts[3];
      data = await api.get(`/schools/${schoolId}/collections/${collectionName}/${docId}`);
    } else if (parts[0] === 'users' && parts.length === 2) {
      data = await api.get(`/auth/profile`);
    }
  } catch (err) {
    console.warn(`Mock getDoc failed for path: ${docRef.path}`, err);
  }

  return {
    exists: () => data !== null,
    data: () => data,
    id: docRef.id
  };
}

// 4. Collection Querying
export async function getDocs(queryRef) {
  const isQuery = queryRef && queryRef.type === 'query';
  const ref = isQuery ? queryRef.ref : queryRef;

  if (!ref || !ref.path) {
    return { empty: true, docs: [] };
  }

  const parts = ref.path.split('/');
  let list = [];

  try {
    if (parts[0] === 'schools' && parts.length === 1) {
      list = await api.get(`/schools`);
    } else if (parts[0] === 'schools' && parts.length >= 3) {
      const schoolId = parts[1];
      const collectionName = parts[2];
      list = await api.get(`/schools/${schoolId}/collections/${collectionName}`);
    }
  } catch (err) {
    console.warn(`Mock getDocs failed for path: ${ref.path}`, err);
  }

  // Handle constraints (where filters)
  if (isQuery && Array.isArray(queryRef.constraints)) {
    queryRef.constraints.forEach(c => {
      if (c && c.type === 'where') {
        list = list.filter(item => {
          const val = item[c.field];
          if (c.op === '==' || c.op === '===') return String(val) === String(c.val);
          return true;
        });
      }
    });
  }

  return {
    empty: list.length === 0,
    docs: list.map(item => ({
      id: item.id,
      data: () => item
    }))
  };
}

// 5. Modifications
export async function updateDoc(docRef, updates) {
  if (!docRef || !docRef.path) return null;
  const parts = docRef.path.split('/');

  try {
    if (parts[0] === 'schools' && parts.length === 2) {
      // Map 'approved' or 'APPROVED' to 'ACTIVE' for Postgres status schema
      if (updates.status && updates.status.toUpperCase() === 'APPROVED') {
        updates.status = 'ACTIVE';
      }
      return await api.put(`/schools/${parts[1]}/status`, updates);
    } else if (parts[0] === 'schools' && parts.length >= 4) {
      const schoolId = parts[1];
      const collectionName = parts[2];
      const docId = parts[3];
      return await api.put(`/schools/${schoolId}/collections/${collectionName}/${docId}`, updates);
    }
  } catch (err) {
    console.error(`Mock updateDoc failed for path: ${docRef.path}`, err);
    throw err;
  }
}

export async function setDoc(docRef, data) {
  return await updateDoc(docRef, data);
}

export async function addDoc(collectionRef, data) {
  if (!collectionRef || !collectionRef.path) return null;
  const parts = collectionRef.path.split('/');

  try {
    if (parts[0] === 'schools' && parts.length >= 3) {
      const schoolId = parts[1];
      const collectionName = parts[2];
      const res = await api.post(`/schools/${schoolId}/collections/${collectionName}`, data);
      return { id: res.id, path: `${collectionRef.path}/${res.id}` };
    }
  } catch (err) {
    console.error(`Mock addDoc failed for path: ${collectionRef.path}`, err);
    throw err;
  }
}

export async function deleteDoc(docRef) {
  if (!docRef || !docRef.path) return null;
  const parts = docRef.path.split('/');

  try {
    if (parts[0] === 'schools' && parts.length >= 4) {
      const schoolId = parts[1];
      const collectionName = parts[2];
      const docId = parts[3];
      return await api.delete(`/schools/${schoolId}/collections/${collectionName}/${docId}`);
    }
  } catch (err) {
    console.error(`Mock deleteDoc failed for path: ${docRef.path}`, err);
    throw err;
  }
}

// 6. Real-Time Observer
export function onSnapshot(ref, onNext, onError) {
  let active = true;

  const fetchAndTrigger = async () => {
    try {
      if (ref.type === 'doc') {
        const snap = await getDoc(ref);
        if (active) onNext(snap);
      } else {
        const snap = await getDocs(ref);
        if (active) onNext(snap);
      }
    } catch (err) {
      if (active && onError) onError(err);
    }
  };

  fetchAndTrigger();
  // Poll every 5 seconds for simulated real-time updates
  const interval = setInterval(fetchAndTrigger, 5000);

  return () => {
    active = false;
    clearInterval(interval);
  };
}

// 7. Utility helpers needed by various pages
export function getFirestore() {
  return db;
}

export function serverTimestamp() {
  return new Date();
}

export function arrayRemove(...args) {
  return { type: 'arrayRemove', values: args };
}

export function arrayUnion(...args) {
  return { type: 'arrayUnion', values: args };
}

export function increment(n = 1) {
  return { type: 'increment', value: n };
}

export default {
  db,
  doc,
  collection,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  getDoc,
  getDocs,
  updateDoc,
  setDoc,
  addDoc,
  deleteDoc,
  onSnapshot,
  getFirestore,
  serverTimestamp,
  arrayRemove,
  arrayUnion,
  increment
};
