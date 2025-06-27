import React from 'react';
import { Loader2 } from 'lucide-react';
import { WorkflowStep } from '../../types';

/**
 * Props for the WorkflowIndicator component
 */
export interface WorkflowIndicatorProps {
  /** Array of workflow steps with their current status */
  workflowSteps: WorkflowStep[];
  /** Optional className for additional styling */
  className?: string;
}

/**
 * WorkflowIndicator component
 * 
 * Displays the progress of a multi-agent workflow with visual status indicators.
 */
const WorkflowIndicator: React.FC<WorkflowIndicatorProps> = ({ workflowSteps, className = '' }) => {
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="text-xs font-semibold text-gray-700 mb-2">Workflow en cours :</div>
      {workflowSteps.map((step) => (
        <div key={step.id} className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${
            step.status === 'completed' ? 'bg-green-500' :
            step.status === 'active' ? 'bg-blue-500 animate-pulse' :
            'bg-gray-300'
          }`}></div>
          <span className={`text-xs ${
            step.status === 'completed' ? 'text-green-700' :
            step.status === 'active' ? 'text-blue-700 font-medium' :
            'text-gray-500'
          }`}>
            {step.name}
          </span>
          {step.status === 'active' && (
            <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
          )}
        </div>
      ))}
    </div>
  );
};

export default WorkflowIndicator;
