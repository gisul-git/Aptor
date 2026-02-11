import React from 'react';

// Import Modular Components
import DashboardHeader, { EmployeeData } from '../../components/employee-dashboard/ui/DashboardHeader';
import SkillDistribution, { SkillData } from '../../components/employee-dashboard/ui/SkillDistribution';
import RecentActivity, { ActivityItem } from '../../components/employee-dashboard/ui/RecentActivity';
import UpcomingAssessments, { AssessmentItem } from '../../components/employee-dashboard/ui/UpcomingAssessments';
import CurrentLearningPath, { LearningPathItem } from '../../components/employee-dashboard/ui/CurrentLearningPath';
import TopSkills, { TopSkillItem } from '../../components/employee-dashboard/ui/TopSkills';

// --- Dynamic Data ---
const CURRENT_EMPLOYEE: EmployeeData = {
  name: "Tushar Mishra",
  role: "Software Engineer",
  department: "Engineering"
};

// --- Dummy Data ---
const DUMMY_SKILLS: SkillData[] = [
  { category: 'General', score: 82 },
  { category: 'DSA', score: 75 },
  { category: 'AI/ML', score: 68 },
  { category: 'Cloud', score: 72 },
  { category: 'DevOps', score: 65 },
  { category: 'Data Eng', score: 70 },
  { category: 'Design', score: 60 },
];

const DUMMY_TOP_SKILLS: TopSkillItem[] = [
  { name: 'React', percentage: 92, level: 'Expert' },
  { name: 'TypeScript', percentage: 88, level: 'Advanced' },
  { name: 'Node.js', percentage: 85, level: 'Advanced' },
  { name: 'Python', percentage: 78, level: 'Intermediate' },
  { name: 'AWS', percentage: 72, level: 'Intermediate' },
];

const DUMMY_ACTIVITIES: ActivityItem[] = [
  { id: 1, type: 'assessment', title: 'Completed Full Stack Developer Assessment', time: '32 min ago', tag: 'assessment' },
  { id: 2, type: 'learning', title: 'Completed module: React Hooks Advanced', time: '2 hours ago', tag: 'learning' },
  { id: 3, type: 'certification', title: 'Earned certification: TypeScript Fundamentals', time: '1 days ago', tag: 'certification' },
  { id: 4, type: 'github', title: 'Pushed 5 commits to project repository', time: '2 days ago', tag: 'github' },
  { id: 5, type: 'learning', title: 'Started AWS Cloud Practitioner Course', time: '3 days ago', tag: 'learning' },
];

const DUMMY_ASSESSMENTS: AssessmentItem[] = [
  { id: 1, category: 'General', title: 'Full Stack Developer Assessment', isOverdue: true, questions: 15, status: 'not_started' },
  { id: 2, category: 'DSA', title: 'Data Structures & Algorithms', isOverdue: false, questions: 15, status: 'in_progress', progress: 45 },
  { id: 3, category: 'Cloud', title: 'AWS Cloud Architecture', isOverdue: true, questions: 15, status: 'not_started' },
];

const DUMMY_PATHS: LearningPathItem[] = [
  { id: 1, title: 'Advanced React Patterns', provider: 'Udemy', duration: '12h', progress: 65 },
  { id: 2, title: 'System Design Masterclass', provider: 'LinkedIn', duration: '8h', progress: 45 },
  { id: 3, title: 'AWS Solutions Architect', provider: 'Udemy', duration: '20h', progress: 0 },
  { id: 4, title: 'Unlock Reassessment', provider: '', duration: '', progress: 65, isLocked: true },
];

const Dashboard = () => {
  return (
    <div style={{ 
      padding: "2rem 3rem", // Increased horizontal padding
      width: "100%",        // Force full width usage
      maxWidth: "2400px",   // Increased from 1800px to avoid "compact" feel
      margin: "0 auto", 
      backgroundColor: "#F8FAFC", 
      minHeight: "100vh",
      boxSizing: "border-box"
    }}>
      
      {/* --- HEADER SECTION --- */}
      <DashboardHeader employeeData={CURRENT_EMPLOYEE} />

      <div style={{ display: "flex", flexDirection: "column", gap: "3rem" }}>
        
        {/* --- MAIN GRID --- */}
        <div style={{ 
            display: "grid", 
            // WIDER RATIO: 2.2 parts left, 1 part right (Previously 1.8fr 1fr)
            gridTemplateColumns: "2.2fr 1fr", 
            gap: "3rem",
            alignItems: "start"
        }}>
           
           {/* Left Column: Assessments & Skills */}
           <div style={{ display: "flex", flexDirection: "column", gap: "3rem" }}>
             <UpcomingAssessments assessments={DUMMY_ASSESSMENTS} />
             <SkillDistribution data={DUMMY_SKILLS} />
           </div>

           {/* Right Column: Sidebar */}
           <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
             <TopSkills skills={DUMMY_TOP_SKILLS} />
             <CurrentLearningPath paths={DUMMY_PATHS} />
           </div>

        </div>

        {/* --- BOTTOM SECTION --- */}
        <div style={{ width: "100%" }}>
          <RecentActivity activities={DUMMY_ACTIVITIES} />
        </div>

      </div>
    </div>
  );
};

export default Dashboard;