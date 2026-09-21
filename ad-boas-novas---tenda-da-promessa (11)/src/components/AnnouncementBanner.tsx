import { useState, useEffect } from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, query, where, limit, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Megaphone, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function AnnouncementBanner() {
  const [isVisible, setIsVisible] = useState(true);

  // Fetch the active announcement
  const announcementQuery = query(
    collection(db, 'settings'),
    where('type', '==', 'announcement'),
    where('active', '==', true),
    limit(1)
  );

  const [snapshot, loading, error] = useCollection(announcementQuery);

  const activeAnnouncement = snapshot?.docs.length ? snapshot.docs[0].data() : null;

  if (loading || error || !activeAnnouncement || !isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, y: -20, height: 0 }}
        className="bg-blue-600 text-white shadow-md relative overflow-hidden rounded-2xl mb-6 border border-blue-500/50"
      >
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] pointer-events-none mix-blend-overlay"></div>
        <div className="px-4 py-3 sm:px-6 flex items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-white/20 p-2 rounded-lg shrink-0">
              <Megaphone className="h-5 w-5 text-white animate-pulse" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm sm:text-base leading-tight truncate">
                {activeAnnouncement.title}
              </p>
              {activeAnnouncement.description && (
                <p className="text-xs sm:text-sm text-white/90 line-clamp-1 mt-0.5">
                  {activeAnnouncement.description}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => setIsVisible(false)}
            className="shrink-0 p-1.5 rounded-lg hover:bg-white/20 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
