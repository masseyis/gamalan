# Salunga User Guide

**Version:** 2.0 - Complete Workflow Edition
**Date:** September 2025

---

## 1. Introduction

Salunga is a comprehensive agile project management platform designed to support modern development teams through their entire workflow. Built with role-based access controls, the platform provides tailored experiences for different team members while maintaining transparency and collaboration.

- **For Product Owners**: Full story lifecycle management from creation to acceptance
- **For Managing Contributors**: Team leadership with sprint planning and member coordination
- **For Contributors**: Task ownership with self-selection and progress tracking
- **For Sponsors**: High-level project oversight and progress monitoring

---

## 2. User Roles & Permissions

### 2.1 Sponsor

- **Purpose**: Strategic oversight and project funding decisions
- **Capabilities**:
  - Monitor high-level project progress and ROI
  - Review team performance metrics
  - View all projects and teams
- **Restrictions**: Cannot create or modify content

### 2.2 Product Owner

- **Purpose**: Product vision and backlog management
- **Capabilities**:
  - Create and manage projects
  - Define and prioritize user stories
  - Set acceptance criteria and story progression
  - Accept completed work
  - Create and manage teams
  - Plan and manage sprints
- **Key Responsibilities**: Product decisions, backlog prioritization, story acceptance

### 2.3 Managing Contributor

- **Purpose**: Technical leadership and team coordination
- **Capabilities**:
  - All contributor capabilities
  - Create and manage teams
  - Manage sprint planning and team settings
  - Coordinate development activities
  - Support other contributors
- **Key Responsibilities**: Team management, technical guidance, sprint coordination

### 2.4 Contributor

- **Purpose**: Individual contributor focused on development
- **Capabilities**:
  - Take ownership of development tasks
  - Update task progress and status
  - View projects, teams, and sprints
  - Collaborate with team members
- **Key Responsibilities**: Task completion, progress updates, quality delivery

---

## 3. Getting Started

### 3.1 Account Setup

1. **Sign in** using the authentication system
2. **Profile Setup**: Your role determines available features
3. **Join Teams**: Connect with your development teams
4. **Explore Projects**: Review active projects and backlogs

### 3.2 Navigation

- **Dashboard**: Overview of your activities and key metrics
- **Projects**: Manage project backlogs and stories
- **Teams**: Team collaboration and sprint management
- **Reports**: Progress tracking and analytics

---

## 4. Project Management

### 4.1 Creating Projects (Product Owners Only)

1. Navigate to **Projects** → **New Project**
2. Enter project details:
   - **Name**: Descriptive project title
   - **Description**: Project objectives and scope
   - **Team Assignment**: Select development team
3. Configure project settings and create initial backlog

### 4.2 Story Management

Stories follow a 9-stage workflow:

**Backlog Stages:**

- **Backlog**: Initial story creation
- **Defined**: Basic requirements specified
- **Estimated**: Story points assigned

**Sprint Stages:**

- **Ready**: Fully prepared for development
- **In Progress**: Active development
- **In Review**: Code review and testing
- **Accepted**: Product Owner approval

**Closure Stages:**

- **Done**: Development complete
- **Delivered**: Released to users

#### Story Creation (Product Owners)

1. Navigate to project backlog
2. Click **New Story**
3. Use the format: "As a [user type], I want [capability] so that [benefit]"
4. Add acceptance criteria using Given/When/Then format
5. Break down into development tasks

#### Story Progression

- Stories advance through stages based on team progress
- Product Owners control acceptance and delivery stages
- All role types can view story details and progress

### 4.3 Task Management

#### Task Ownership (Contributors)

1. **Browse Available Tasks**: View tasks in Ready stories
2. **Self-Selection**: Choose tasks matching your specialty
3. **Status Updates**: Keep progress current (Not Started → In Progress → Complete)
4. **Collaboration**: Communicate blockers and updates

#### Task Creation (Product Owners)

- Break stories into specific, actionable tasks
- Map tasks to acceptance criteria
- Estimate complexity and assign story points

---

## 5. Team Management

### 5.1 Team Creation (Product Owners & Managing Contributors)

1. Navigate to **Teams** → **Create Team**
2. Set team details:
   - **Name**: Team identifier
   - **Description**: Team focus and responsibilities
3. Invite team members with appropriate roles
4. Configure team capacity and velocity tracking

### 5.2 Team Collaboration

- **Member Management**: Add/remove team members
- **Specialty Assignment**: Contributors specify their technical focus
- **Velocity Tracking**: Monitor team performance over time
- **Capacity Planning**: Plan sprint workload based on availability

### 5.3 Team Settings

- **Basic Information**: Update name and description
- **Member Roles**: Manage role assignments
- **Team Statistics**: View performance metrics
- **Access Controls**: Team deletion and configuration

---

## 6. Sprint Management

### 6.1 Sprint Planning (Product Owners & Managing Contributors)

1. Navigate to **Teams** → **[Team]** → **Sprints** → **New Sprint**
2. Configure sprint details:
   - **Name**: Sprint identifier
   - **Goal**: Clear sprint objective
   - **Capacity**: Total story points the team can handle
   - **Timeline**: Start and end dates (1-28 days recommended)
3. Add stories to sprint backlog
4. Start sprint when ready

### 6.2 Sprint Workflow

**Planning**: Set goals, estimate capacity, prepare stories
**Active**: Track daily progress, manage scope changes
**Review**: Demo completed work, gather feedback
**Completed**: Close sprint and analyze performance

### 6.3 Sprint Tracking

- **Progress Monitoring**: Visual progress indicators
- **Capacity vs. Commitment**: Track planned vs. actual work
- **Velocity Calculation**: Automatic velocity tracking for future planning
- **Daily Updates**: Regular status monitoring

---

## 7. Role-Based Workflows

### 7.1 Product Owner Daily Workflow

1. **Review Story Progress**: Check development status
2. **Accept Completed Work**: Review and approve finished stories
3. **Refine Backlog**: Add new stories, update priorities
4. **Sprint Planning**: Prepare upcoming sprint capacity
5. **Stakeholder Updates**: Communicate progress to sponsors

### 7.2 Managing Contributor Workflow

1. **Team Coordination**: Monitor team progress and blockers
2. **Sprint Management**: Adjust capacity and resolve issues
3. **Technical Guidance**: Support team members with complex tasks
4. **Task Ownership**: Take on critical development work
5. **Process Improvement**: Optimize team workflows

### 7.3 Contributor Workflow

1. **Task Selection**: Choose tasks matching skills and capacity
2. **Progress Updates**: Maintain current status on all tasks
3. **Quality Focus**: Deliver work meeting acceptance criteria
4. **Team Collaboration**: Communicate with team members
5. **Continuous Learning**: Improve skills and expand capabilities

### 7.4 Sponsor Workflow

1. **Project Monitoring**: Track high-level progress across projects
2. **Team Performance**: Review velocity and delivery metrics
3. **Strategic Decisions**: Make resource allocation decisions
4. **Stakeholder Communication**: Report progress to executives

---

## 8. User Guidance System

### 8.1 Contextual Help

- **Role-Based Guidance**: Tailored help based on your role
- **Page-Specific Tips**: Context-aware assistance
- **Action Tooltips**: Explanations for restricted actions
- **Best Practices**: Inline guidance for optimal workflows

### 8.2 Permission System

- **Transparent Restrictions**: Clear explanations when actions are unavailable
- **Role Education**: Understanding why certain features are restricted
- **Alternative Actions**: Suggested alternatives when permissions limit actions

---

## 9. Best Practices

### 9.1 Story Writing

- Use clear, user-focused language
- Include specific acceptance criteria
- Break large stories into manageable pieces
- Estimate complexity collaboratively

### 9.2 Sprint Planning

- Consider team capacity and velocity history
- Leave buffer for unexpected work
- Set clear, achievable sprint goals
- Plan for dependencies and blockers

### 9.3 Task Management

- Take ownership early in sprint
- Update status regularly
- Communicate blockers immediately
- Complete tasks in logical order

### 9.4 Team Collaboration

- Maintain transparent communication
- Support team members proactively
- Share knowledge and expertise
- Focus on team success over individual achievements

---

## 10. Troubleshooting

### 10.1 Common Issues

- **Can't create stories**: Check role permissions (Product Owner required)
- **Can't take task ownership**: Verify contributor role assignment
- **Can't manage team**: Requires Product Owner or Managing Contributor role
- **Can't start sprint**: Check team active sprint status

### 10.2 Getting Help

- **In-App Guidance**: Use contextual help and tooltips
- **Role Explanations**: Review role-specific responsibilities
- **Team Coordination**: Contact Product Owner or Managing Contributor
- **Technical Support**: Contact system administrators

---

## 11. Feature Roadmap

### 11.1 Current Features (v2.0)

- Complete story lifecycle management
- Role-based access controls
- Team and sprint management
- Task ownership system
- Progress tracking and reporting

### 11.2 Upcoming Features

- AI-powered assistant integration
- Advanced analytics and reporting
- GitHub integration for PR tracking
- Automated testing workflows
- Enhanced notification system

---

## 12. Support & Resources

### 12.1 Additional Resources

- **Team Onboarding**: Contact your Product Owner for role assignment
- **Best Practices Guide**: Available in application user guidance
- **Process Training**: Role-specific workflow training materials

### 12.2 Getting Support

- **In-App Help**: Contextual guidance throughout the application
- **Team Support**: Coordinate with Product Owners and Managing Contributors
- **Technical Issues**: Contact development team or system administrators

---

_This guide reflects the current state of Salunga v2.0. Features and workflows may be updated as the platform evolves. Check in-application guidance for the most current information._
