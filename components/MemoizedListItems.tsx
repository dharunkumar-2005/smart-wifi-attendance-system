import React from 'react';

/**
 * Memoized Present Student Item - Prevents unnecessary re-renders
 */
interface PresentItemProps {
  name: string;
  regNo: string;
  time: string;
  photoUrl?: string;
  onPhotoClick?: (regNo: string) => void;
}

export const MemoizedPresentItem = React.memo<PresentItemProps>(
  ({ name, regNo, time, photoUrl, onPhotoClick }) => (
    <div className="bg-gradient-to-r from-white/5 to-transparent border border-white/10 p-4 rounded-2xl flex items-center justify-between hover:border-white/20 transition-all group will-change-transform"
      style={{ transform: 'translateZ(0)' }} // GPU acceleration
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {photoUrl && (
          <div
            className="w-12 h-12 rounded-xl overflow-hidden cursor-pointer flex-shrink-0 hover:scale-105 transition-transform will-change-transform"
            onClick={() => onPhotoClick?.(regNo)}
            style={{ transform: 'translateZ(0)' }}
          >
            <img
              src={photoUrl}
              alt={name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-sm text-white truncate">{name}</h4>
          <p className="text-xs text-gray-400 font-mono">{regNo}</p>
        </div>
      </div>
      <p className="text-xs text-[#00ffa3] font-bold whitespace-nowrap ml-4">{time}</p>
    </div>
  ),
  (prevProps, nextProps) => {
    // Custom comparison - only re-render if these values change
    return (
      prevProps.regNo === nextProps.regNo &&
      prevProps.time === nextProps.time &&
      prevProps.name === nextProps.name &&
      prevProps.photoUrl === nextProps.photoUrl
    );
  }
);

MemoizedPresentItem.displayName = 'MemoizedPresentItem';

/**
 * Memoized Absent Student Item
 */
interface AbsentItemProps {
  name: string;
  regNo: string;
}

export const MemoizedAbsentItem = React.memo<AbsentItemProps>(
  ({ name, regNo }) => (
    <div
      className="bg-gradient-to-r from-red-500/10 to-transparent border border-red-500/30 p-4 rounded-2xl flex items-center justify-between hover:border-red-500/80 transition-all will-change-transform"
      style={{ transform: 'translateZ(0)' }}
    >
      <div className="flex-1">
        <h4 className="font-bold text-sm text-white">{name}</h4>
        <p className="text-xs text-gray-400 font-mono">{regNo}</p>
      </div>
      <span className="text-xs bg-red-500/20 text-red-400 px-3 py-1 rounded-lg font-bold">
        ABSENT
      </span>
    </div>
  ),
  (prevProps, nextProps) => {
    return (
      prevProps.regNo === nextProps.regNo &&
      prevProps.name === nextProps.name
    );
  }
);

MemoizedAbsentItem.displayName = 'MemoizedAbsentItem';

/**
 * Memoized Student List Item (for management)
 */
interface StudentListItemProps {
  name: string;
  regNo: string;
  email?: string;
  isDeleting: boolean;
  isConfirming: boolean;
  isResettingDevice?: boolean;
  onDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onResetDevice?: () => void;
}

export const MemoizedStudentListItem = React.memo<StudentListItemProps>(
  ({
    name,
    regNo,
    email,
    isDeleting,
    isConfirming,
    isResettingDevice,
    onDelete,
    onCancelDelete,
    onConfirmDelete,
    onResetDevice
  }) => (
    <div
      className="bg-gradient-to-r from-white/5 to-transparent border border-white/10 p-4 rounded-2xl flex items-center justify-between hover:border-white/20 transition-all group will-change-transform"
      style={{ transform: 'translateZ(0)' }}
    >
      <div className="flex-1">
        <h4 className="font-bold text-sm text-white">{name}</h4>
        <p className="text-xs text-gray-400 mt-1">
          <span className="font-mono">{regNo}</span>
          {email && <span className="ml-4">📧 {email}</span>}
        </p>
      </div>

      {isConfirming ? (
        <div className="flex items-center gap-2">
          <button
            onClick={onConfirmDelete}
            disabled={isDeleting}
            className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-all disabled:opacity-50"
          >
            {isDeleting ? '...' : 'CONFIRM'}
          </button>
          <button
            onClick={onCancelDelete}
            className="px-3 py-1 bg-gray-700 text-white text-xs font-bold rounded-lg hover:bg-gray-600 transition-all"
          >
            CANCEL
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {onResetDevice && (
            <button
              onClick={onResetDevice}
              disabled={isResettingDevice}
              className="px-3 py-2 bg-gradient-to-r from-[#ffa500] to-[#ff8c00] text-black text-xs font-bold rounded-lg hover:shadow-[0_0_20px_#ffa500] transition-all disabled:opacity-50 flex items-center gap-1"
            >
              🔓 RESET LOCK
            </button>
          )}
          <button
            onClick={onDelete}
            className="px-4 py-2 bg-transparent border border-red-500 text-red-400 rounded-lg text-xs font-bold hover:bg-red-500/20 transition-all flex items-center gap-2"
          >
            🗑️ DELETE
          </button>
        </div>
      )}
    </div>
  ),
  (prevProps, nextProps) => {
    return (
      prevProps.regNo === nextProps.regNo &&
      prevProps.name === nextProps.name &&
      prevProps.email === nextProps.email &&
      prevProps.isDeleting === nextProps.isDeleting &&
      prevProps.isConfirming === nextProps.isConfirming &&
      prevProps.isResettingDevice === nextProps.isResettingDevice
    );
  }
);

MemoizedStudentListItem.displayName = 'MemoizedStudentListItem';
