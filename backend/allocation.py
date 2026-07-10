import heapq
import math
import random

def calculate_lambda(h_prev, theta=0.5, lambda_base=0.3, gamma=1.0, beta=0.5):
    """
    Dynamic Threshold Algorithm:
    Determines the fairness weight (lambda) based on historical satisfaction.
    """
    if h_prev < theta:
        # Increase lambda (priority to fairness) if satisfaction is below threshold
        return min(1.0, lambda_base + gamma * (theta - h_prev))
    else:
        # Decrease lambda (priority to preferences) if satisfaction is above threshold
        return max(0.0, lambda_base - beta * (h_prev - theta))

def calculate_priority_score(points, lambda_val, fairness_score):
    """
    Priority Score formula:
    Priority Score = PP + (lambda * FS)
    where PP is raw points, FS is fairness_score * 100
    """
    return points + lambda_val * (fairness_score * 100.0)

def get_prsm_satisfaction(rank, total_prefs):
    """
    Preference Rank Satisfaction Mapping (PRSM):
    Calculates current satisfaction based on the rank of the allocated elective.
    Rank 1 is the top choice.
    """
    if total_prefs <= 0 or rank is None:
        return 0.0
    return 1.0 - ((rank - 1) / total_prefs)

def apply_running_avg(h_prev, s_curr, n=None):
    """
    Simple Average of Previous Historical and Current Satisfaction:
    h_new = (h_prev + s_curr) / 2
    """
    return (h_prev + s_curr) / 2.0

def apply_raa(h_prev, s_curr, alpha=0.6):
    """
    Running Average Algorithm (RAA) with exponential decay:
    h_new = alpha * h_prev + (1.0 - alpha) * s_curr
    """
    return alpha * h_prev + (1.0 - alpha) * s_curr

class MaxHeapEntry:
    """
    Wrapper for heapq to simulate a Max Heap using Python's min-heap.
    """
    def __init__(self, score, student_id, elective_id, points, rank):
        self.score = score
        self.student_id = student_id
        self.elective_id = elective_id
        self.points = points
        self.rank = rank

    def __lt__(self, other):
        # We sort descending by score. If scores are equal, sort descending by points.
        # If points are equal, sort ascending by rank (lower rank is preferred).
        if math.isclose(self.score, other.score):
            if self.points == other.points:
                return self.rank < other.rank
            return self.points > other.points
        return self.score > other.score

def simulate_allocation(students, electives, preferences, max_electives=1, 
                        alpha=0.6, theta=0.5, lambda_base=0.3, gamma=1.0, beta=0.5,
                        new_student_ids=None, sat_counts=None):
    """
    Simulates the elective allocation process in memory and returns a trace of execution.
    
    students: list of dicts [{'id': 1, 'username': 'stud1', 'historical_satisfaction': 0.5}]
    electives: list of dicts [{'id': 1, 'code': 'CS1', 'name': 'Algo', 'capacity': 2, 'seats_remaining': 2}]
    preferences: list of dicts [{'user_id': 1, 'elective_id': 1, 'points': 60, 'rank': 1}]
    
    Returns a trace (list of events) and the final allocations and updated student satisfaction.
    """
    if new_student_ids is None:
        new_student_ids = set()
    if sat_counts is None:
        sat_counts = {}
        
    # Pre-generate stable random priorities for new students to maintain consistency across heap rebuilds
    new_student_priorities = {}
    for s_id in new_student_ids:
        new_student_priorities[s_id] = random.random()

    # 1. Index data structures for fast access
    student_map = {s['id']: dict(s) for s in students}
    # Initialize dynamic student state
    for s_id, s in student_map.items():
        s['curr_hist_sat'] = s['historical_satisfaction']
        s['allocated_count'] = 0
        s['allocated_electives'] = [] # list of elective_ids
        s['total_prefs'] = 0
        # Number of past semesters already counted in historical_satisfaction
        s['sat_semester_count'] = sat_counts.get(s_id, 0)
        
    elective_map = {e['id']: dict(e) for e in electives}
    
    # Structure preferences by student
    student_prefs = {}
    for p in preferences:
        s_id = p['user_id']
        if s_id not in student_prefs:
            student_prefs[s_id] = []
        student_prefs[s_id].append(p)
        
    for s_id, prefs in student_prefs.items():
        # Sort prefs by points descending, then rank ascending
        prefs.sort(key=lambda x: (-x['points'], x['rank']))
        # Re-assign sequential rank just to be safe
        for idx, pref in enumerate(prefs):
            pref['rank'] = idx + 1
        if s_id in student_map:
            student_map[s_id]['total_prefs'] = len(prefs)

    # 2. Priority calculation helper
    def get_heap_entries_for_student(s_id):
        s = student_map[s_id]
        limit = s.get('max_electives', max_electives)
        if s['allocated_count'] >= limit:
            return []
        
        # Calculate dynamic properties
        h_prev = s['curr_hist_sat']
        f_score = 1.0 - h_prev
        l_val = calculate_lambda(h_prev, theta, lambda_base, gamma, beta)
        
        is_new = s_id in new_student_ids
        r_student = new_student_priorities.get(s_id, 0.0)
        
        entries = []
        prefs = student_prefs.get(s_id, [])
        for p in prefs:
            e_id = p['elective_id']
            # Skip if student is already allocated this elective
            if e_id in s['allocated_electives']:
                continue
            
            if is_new:
                # New student has random allocation priority relative to other students,
                # but respects their own ranked choices (lower rank is preferred).
                p_score = r_student - (p['rank'] - 1) * 0.001
            else:
                p_score = calculate_priority_score(p['points'], l_val, f_score)
            
            entries.append(
                MaxHeapEntry(
                    score=p_score,
                    student_id=s_id,
                    elective_id=e_id,
                    points=p['points'],
                    rank=p['rank']
                )
            )
        return entries

    # 3. Build Global Heap
    global_heap = []
    for s_id in student_map:
        for entry in get_heap_entries_for_student(s_id):
            heapq.heappush(global_heap, entry)

    trace = []
    allocations = []
    
    step_num = 0
    # Keep track of active heap items. Since we do dynamic updates, the heap might contain
    # outdated elements. We can either rebuild the heap or lazy-evaluate. Rebuilding is simple and correct.
    while global_heap:
        step_num += 1
        entry = heapq.heappop(global_heap)
        
        s_id = entry.student_id
        e_id = entry.elective_id
        score = entry.score
        
        student = student_map[s_id]
        elective = elective_map[e_id]
        
        # Check current state of heap entry to see if it is outdated
        # Let's check if student has already filled max electives
        limit = student.get('max_electives', max_electives)
        if student['allocated_count'] >= limit:
            trace.append({
                'step': step_num,
                'type': 'skipped',
                'student_id': s_id,
                'student_name': student['username'],
                'elective_id': e_id,
                'elective_code': elective['code'],
                'score': score,
                'reason': 'Student already allocated maximum allowed electives.'
            })
            continue
            
        # Check if student is already allocated this elective
        if e_id in student['allocated_electives']:
            continue
            
        # Check if seats are available
        if elective['seats_remaining'] <= 0:
            trace.append({
                'step': step_num,
                'type': 'skipped',
                'student_id': s_id,
                'student_name': student['username'],
                'elective_id': e_id,
                'elective_code': elective['code'],
                'score': score,
                'reason': f"Elective {elective['code']} has no remaining seats."
            })
            continue

        # Allocation Success!
        elective['seats_remaining'] -= 1
        student['allocated_count'] += 1
        student['allocated_electives'].append(e_id)
        
        allocations.append({
            'user_id': s_id,
            'username': student['username'],
            'elective_id': e_id,
            'elective_code': elective['code'],
            'elective_name': elective['name'],
            'points': entry.points,
            'rank': entry.rank
        })
        
        # Recalculate satisfaction and update historical satisfaction (Simple Running Average)
        rank = entry.rank
        total_prefs = student['total_prefs']
        s_curr = get_prsm_satisfaction(rank, total_prefs)
        
        h_prev = student['curr_hist_sat']
        n = student['sat_semester_count']
        h_new = apply_running_avg(h_prev, s_curr, n)
        student['curr_hist_sat'] = h_new
        student['sat_semester_count'] = n + 1
        
        # Recalculate lambda and fairness for the trace
        f_score_new = 1.0 - h_new
        lambda_new = calculate_lambda(h_new, theta, lambda_base, gamma, beta)

        trace_event = {
            'step': step_num,
            'type': 'allocated',
            'student_id': s_id,
            'student_name': student['username'],
            'elective_id': e_id,
            'elective_code': elective['code'],
            'elective_name': elective['name'],
            'score': score,
            'preference_points': entry.points,
            'preference_rank': rank,
            'seats_remaining': elective['seats_remaining'],
            'current_satisfaction': s_curr,
            'historical_satisfaction_prev': h_prev,
            'historical_satisfaction_new': h_new,
            'fairness_score_new': f_score_new,
            'lambda_new': lambda_new,
            'details': f"Allocated {student['username']} to {elective['code']}. Rank: {rank}, Curr Sat: {s_curr:.2f}, Hist Sat updated: {h_prev:.2f} -> {h_new:.2f}"
        }
        
        # Dynamically recalculate scores for this student's remaining preferences and rebuild heap
        # (This is important if max_electives > 1 and the student still needs more electives)
        limit = student.get('max_electives', max_electives)
        if student['allocated_count'] < limit:
            # Rebuild the heap to incorporate new priority scores
            # First filter out other students and outdated entries of this student
            new_heap = []
            # Keep other students' entries in heap (they haven't changed)
            for item in global_heap:
                if item.student_id != s_id:
                    new_heap.append(item)
            # Add updated entries for this student
            for item in get_heap_entries_for_student(s_id):
                new_heap.append(item)
                
            heapq.heapify(new_heap)
            global_heap = new_heap
            trace_event['details'] += " | Priority scores for remaining choices updated, heap rebuilt."
            
        trace.append(trace_event)
        
    # Any student who got no elective gets current satisfaction of 0
    for s_id, student in student_map.items():
        if student['allocated_count'] == 0:
            h_prev = student['curr_hist_sat']
            n = student['sat_semester_count']
            h_new = apply_running_avg(h_prev, 0.0, n)
            student['curr_hist_sat'] = h_new
            student['sat_semester_count'] = n + 1
            
            trace.append({
                'step': step_num + 1,
                'type': 'unallocated',
                'student_id': s_id,
                'student_name': student['username'],
                'historical_satisfaction_prev': h_prev,
                'historical_satisfaction_new': h_new,
                'details': f"Student {student['username']} did not receive any elective. Current Sat: 0.0, Hist Sat updated: {h_prev:.2f} -> {h_new:.2f}"
            })
            
    # Compile statistics for comparison
    return trace, allocations, student_map

def run_live_allocation(semester, max_electives=1, alpha=0.6, theta=0.5, 
                        lambda_base=0.3, gamma=1.0, beta=0.5, new_student_ids=None, sat_counts=None):
    """
    Runs the allocation engine on the current database state, writes results to the database,
    and returns a summary of changes.
    """
    import models
    app = models.get_app()
    with app.app_context():
        # 1. Fetch current data
        students_db = models.User.query.filter_by(role='student').all()
        electives_db = models.Elective.query.all()
        preferences_db = models.Preference.query.all()
        
        students = [{'id': s.id, 'username': s.username, 'historical_satisfaction': s.historical_satisfaction, 'max_electives': s.max_electives} for s in students_db]
        electives = [{'id': e.id, 'code': e.code, 'name': e.name, 'capacity': e.capacity, 'seats_remaining': e.seats_remaining, 'instructor': e.instructor} for e in electives_db]
        preferences = [{'user_id': p.user_id, 'elective_id': p.elective_id, 'points': p.points, 'rank': p.rank} for p in preferences_db]
        
        # Reset seats remaining to full capacity before run
        for e in electives:
            e['seats_remaining'] = e['capacity']
            
        # 2. Run simulation in memory to get trace and allocations
        trace, allocations, updated_student_map = simulate_allocation(
            students, electives, preferences, max_electives, alpha, theta, lambda_base, gamma, beta,
            new_student_ids=new_student_ids, sat_counts=sat_counts
        )
        
        # 3. Write results back to database in a transaction
        try:
            # Delete prior allocations for this semester
            models.Allocation.query.filter_by(semester=semester).delete()
            # Delete prior history for this semester if it exists
            models.SatisfactionHistory.query.filter_by(semester=semester).delete()
            
            # Save allocations
            for alloc in allocations:
                new_alloc = models.Allocation(
                    user_id=alloc['user_id'],
                    elective_id=alloc['elective_id'],
                    semester=semester
                )
                models.db.session.add(new_alloc)
                
            # Update students historical satisfaction & add satisfaction history entries
            for s_id, s in updated_student_map.items():
                h_new = s['curr_hist_sat']
                student_user = models.User.query.get(s_id)
                if student_user:
                    student_user.historical_satisfaction = h_new
                
                # Determine satisfaction score for this semester
                allocs = [a for a in allocations if a['user_id'] == s_id]
                if allocs:
                    rank = allocs[0]['rank']
                    s_curr = get_prsm_satisfaction(rank, s['total_prefs'])
                else:
                    s_curr = 0.0
                    
                new_sat_hist = models.SatisfactionHistory(
                    user_id=s_id,
                    semester=semester,
                    satisfaction_score=s_curr,
                    historical_satisfaction_after=h_new
                )
                models.db.session.add(new_sat_hist)
                
            # Update elective seats remaining in database
            for e_id, elective in elective_map_update(electives, allocations).items():
                el = models.Elective.query.get(e_id)
                if el:
                    el.seats_remaining = elective['seats_remaining']
                    
            models.db.session.commit()
            return True, trace, allocations
        except Exception as e:
            models.db.session.rollback()
            return False, str(e), []

def elective_map_update(electives, allocations):
    # Compute final seats remaining
    el_map = {e['id']: dict(e) for e in electives}
    for e in el_map.values():
        e['seats_remaining'] = e['capacity']
    for alloc in allocations:
        e_id = alloc['elective_id']
        if e_id in el_map:
            el_map[e_id]['seats_remaining'] -= 1
    return el_map
