interface LoadingSpinnerProps {
  text?: string;
  spinner?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  text = "Loading",
  spinner = false,
}) => {
  return (
    <div className="jusify-center flex items-center text-xs uppercase tracking-[0.15em]">
      <div className="mr-2">
        {text}
        {!spinner && "..."}
      </div>
      {spinner && (
        <svg
          width="28"
          height="24"
          viewBox="0 0 28 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="4" cy="12" r="3" opacity="1" fill="#FFF">
            <animate
              id="spinner_qYjJ"
              begin="0;spinner_t4KZ.end-0.25s"
              attributeName="opacity"
              dur="0.75s"
              values="1;.2"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="14" cy="12" r="3" opacity=".4" fill="#FFF">
            <animate
              begin="spinner_qYjJ.begin+0.15s"
              attributeName="opacity"
              dur="0.75s"
              values="1;.2"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="24" cy="12" r="3" opacity=".3" fill="#FFF">
            <animate
              id="spinner_t4KZ"
              begin="spinner_qYjJ.begin+0.3s"
              attributeName="opacity"
              dur="0.75s"
              values="1;.2"
              repeatCount="indefinite"
            />
          </circle>
        </svg>
      )}
    </div>
  );
};
