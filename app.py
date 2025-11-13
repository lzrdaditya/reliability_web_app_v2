# (Imports and helper function remain the same)
from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
import os
import numpy as np
import scipy.special
# Ensure matplotlib uses a non-interactive backend to avoid GUI/main-thread errors
try:
    import matplotlib
    matplotlib.use('Agg')
except Exception:
    pass

from reliability.Fitters import Fit_Weibull_2P
try:
    from flask_cors import CORS
except ImportError:
    print('flask_cors not installed. Run: pip install flask-cors')
    CORS = lambda app, **kwargs: None
import re
from datetime import datetime, timezone

app = Flask(__name__)
# Prefer environment SECRET_KEY in production
app.secret_key = os.environ.get('SECRET_KEY', 'change_this_secret')

# Configure CORS origins via environment variable (comma-separated) in production
origins = os.environ.get('FRONTEND_ORIGINS', '*')
if origins.strip() == '*':
    CORS(app, supports_credentials=True)
else:
    allowed = [o.strip() for o in origins.split(',') if o.strip()]
    CORS(app, supports_credentials=True, resources={r"/api/*": {"origins": allowed}})

def get_weibull_pattern(beta):
    if beta is None: return None
    if beta > 1.1: return "Age-related failure"
    elif beta < 0.9: return "Infant mortality (RCA Required)"
    else: return "Random failure"

def convert_hours(hours):
    """Converts a value in hours to days, months, and years."""
    if not isinstance(hours, (int, float)):
        return None, None, None
    days = hours / 24
    # Using an average of 30.4375 days per month (365.25 / 12)
    months = days / 30.4375 
    years = days / 365.25
    return round(days, 4), round(months, 4), round(years, 4)

# (step1_method remains the same)
@app.route("/", methods=["GET", "POST"])
@app.route("/step1", methods=["GET", "POST"])
def step1_method():
    if request.method == "POST":
        session.clear() # Add this line
        method = request.form.get("input_method", "failure")
        session["input_method"] = method
        return redirect(url_for("step2_input"))
    return render_template("step1_method.html")

# ...existing code...
@app.route("/convert", methods=["GET", "POST"]) # Corrected route from fix #1
def preprocess_dates():
    if request.method == "POST":
        # (The beginning of this function is unchanged)
        TTF_MIN_HOURS = 1 * 7 * 24
        TTF_MAX_HOURS = 3.5 * 365.25 * 24

        raw_text = request.form.get("raw_dates", "")

        # Accept both "YYYY-MM-DD HH:MM:SS" and ISO 8601 variants (with 'T', fractional seconds, Z or ±HH:MM)
        import re
        from datetime import datetime

        iso_like = re.findall(r'\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+\-]\d{2}:?\d{2})?', raw_text)
        if not iso_like:
            error = "Please paste at least two valid timestamps (supports ISO 8601 and 'YYYY-MM-DD HH:MM:SS')."
            return render_template("preprocess_dates.html", error=error)

        datetimes = []
        for s in iso_like:
            parsed = None
            try:
                # Normalize space -> T for fromisoformat
                s_norm = s.replace(' ', 'T')
                # Replace trailing Z with +00:00 for fromisoformat
                if s_norm.endswith('Z'):
                    s_norm = s_norm[:-1] + '+00:00'
                # Python's fromisoformat handles offsets like +HH:MM
                parsed = datetime.fromisoformat(s_norm)
            except Exception:
                # Fallbacks for common variants
                for fmt in ('%Y-%m-%d %H:%M:%S',
                            '%Y-%m-%dT%H:%M:%S',
                            '%Y-%m-%dT%H:%M:%S.%f',
                            '%Y-%m-%dT%H:%M:%S%z',
                            '%Y-%m-%dT%H:%M:%S.%f%z'):
                    try:
                        parsed = datetime.strptime(s, fmt)
                        break
                    except Exception:
                        continue
            if parsed:
                datetimes.append(parsed)

        if len(datetimes) < 2:
            error = "Please paste at least two valid timestamps to calculate a failure time."
            return render_template("preprocess_dates.html", error=error)

        datetimes.sort()

        all_failures_in_hours = []
        for i in range(1, len(datetimes)):
            delta = datetimes[i] - datetimes[i-1]
            hours = delta.total_seconds() / 3600
            all_failures_in_hours.append(hours)

        # Ensure all results are rounded to integer before passing to next page
        filtered_failures = [
            int(round(h, 0))
            for h in all_failures_in_hours
            if TTF_MIN_HOURS < h < TTF_MAX_HOURS
        ]

        if not filtered_failures:
            error = "No valid failure durations found. All calculated TTFs were either less than 1 week or more than 3.5 years."
            return render_template("preprocess_dates.html", error=error, raw_text=raw_text)

        session['pre_filled_failures'] = filtered_failures

        # NEW: Store the original sorted datetimes (as strings) in the session.
        session['original_datetimes'] = [dt.isoformat() for dt in datetimes]

        return redirect(url_for('step2_input'))

    return render_template("preprocess_dates.html")


@app.route('/api/convert', methods=['POST'])
def api_convert():
    """JSON API that accepts raw timestamps (form or JSON) and returns pre-filled failure hours and original datetimes.
    This reuses the same parsing and filtering rules as the HTML form handler, but responds with JSON so the Next.js frontend can consume it.
    """
    TTF_MIN_HOURS = 1 * 7 * 24
    TTF_MAX_HOURS = 3.5 * 365.25 * 24

    # Accept form-encoded or JSON
    raw_text = ''
    if request.is_json:
        raw_text = (request.get_json() or {}).get('raw_dates', '')
    else:
        raw_text = request.form.get('raw_dates', '')

    if not raw_text:
        return jsonify({ 'error': 'No timestamps provided.' }), 400

    # Use same regex and parsing strategy as preprocess_dates
    iso_like = re.findall(r"\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+\-]\d{2}:?\d{2})?", raw_text)
    if not iso_like:
        return jsonify({ 'error': "Please paste at least two valid timestamps (supports ISO 8601 and 'YYYY-MM-DD HH:MM:SS')." }), 400

    datetimes = []
    for s in iso_like:
        parsed = None
        try:
            s_norm = s.replace(' ', 'T')
            if s_norm.endswith('Z'):
                s_norm = s_norm[:-1] + '+00:00'
            parsed = datetime.fromisoformat(s_norm)
        except Exception:
            for fmt in ('%Y-%m-%d %H:%M:%S',
                        '%Y-%m-%dT%H:%M:%S',
                        '%Y-%m-%dT%H:%M:%S.%f',
                        '%Y-%m-%dT%H:%M:%S%z',
                        '%Y-%m-%dT%H:%M:%S.%f%z'):
                try:
                    parsed = datetime.strptime(s, fmt)
                    break
                except Exception:
                    continue
        if parsed:
            # normalize timezone-aware to UTC naive timestamps
            if parsed.tzinfo is not None:
                parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
            datetimes.append(parsed)

    if len(datetimes) < 2:
        return jsonify({ 'error': 'Please paste at least two valid timestamps to calculate a failure time.' }), 400

    datetimes.sort()
    all_failures_in_hours = []
    for i in range(1, len(datetimes)):
        delta = datetimes[i] - datetimes[i-1]
        hours = delta.total_seconds() / 3600
        all_failures_in_hours.append(hours)

    filtered_failures = [ int(round(h,0)) for h in all_failures_in_hours if TTF_MIN_HOURS < h < TTF_MAX_HOURS ]

    if not filtered_failures:
        return jsonify({ 'error': 'No valid failure durations found. All calculated TTFs were either less than 1 week or more than 3.5 years.' }), 400

    # Return results (strings for datetimes)
    return jsonify({ 'pre_filled_failures': filtered_failures, 'original_datetimes': [dt.isoformat() for dt in datetimes] })


@app.route('/api/step2', methods=['POST'])
def api_step2():
    """Stateless API: accept failures and various censored data types and return MLE and Rank Regression results as JSON.
    Request JSON: { 
        failures: [..], 
        right_censored: [..],
        left_censored: [..],
        interval_data: [{start, end}, ...],
        grouped_data: [{time, freq}, ...],
        modes: {rightCensored, interval, grouped}
    }
    Response: { results_mle: {...}, results_rr: {...} }
    """
    data = {}
    if request.is_json:
        data = request.get_json() or {}
    else:
        # Support form-encoded (legacy)
        data = { 'failures': request.form.getlist('failures'), 'right_censored': request.form.getlist('censored') }

    failures = data.get('failures') or []
    right_censored = data.get('right_censored') or []
    left_censored = data.get('left_censored') or []
    interval_data = data.get('interval_data') or []
    grouped_data = data.get('grouped_data') or []
    modes = data.get('modes') or {}
    rr_method = data.get('rr_method', 'LS')

    # Convert to numeric
    try:
        failures = [float(x) for x in failures] if failures else []
        right_censored = [float(x) for x in right_censored] if right_censored else []
        left_censored = [float(x) for x in left_censored] if left_censored else []
    except Exception:
        return jsonify({'error': 'Invalid numeric data in failures or censored arrays.'}), 400

    # Build interval censoring arrays if provided
    interval_lower = []
    interval_upper = []
    if interval_data:
        for item in interval_data:
            try:
                interval_lower.append(float(item['start']))
                interval_upper.append(float(item['end']))
            except:
                return jsonify({'error': 'Invalid interval data format.'}), 400

    # Expand grouped data into failures/right_censored lists based on state
    if grouped_data:
        for item in grouped_data:
            try:
                t = float(item['time'])
                freq = int(item['freq'])
                state = item.get('state')  # Optional state field (F or S)
                
                if state:
                    # Expand with state consideration
                    if state == 'F':
                        failures.extend([t] * freq)
                    elif state == 'S':
                        right_censored.extend([t] * freq)
                else:
                    # No state = treat all as failures
                    failures.extend([t] * freq)
            except:
                return jsonify({'error': 'Invalid grouped data format.'}), 400

    if len(failures) < 1 and len(interval_lower) < 1 and len(left_censored) < 1:
        return jsonify({'error': 'At least one failure or censored observation is required for analysis.'}), 400

    def safe_round(val, nd=2):
        try:
            return round(float(val), nd)
        except Exception:
            return None

    out = {}
    
    # MLE Fit
    try:
        # Use Fit_Weibull_2P with appropriate parameters based on data types
        fit_args = {'failures': failures, 'show_plot': False}
        
        if right_censored:
            fit_args['right_censored'] = right_censored
        if left_censored:
            fit_args['left_censored'] = left_censored
        if interval_lower and interval_upper:
            fit_args['interval_censored'] = list(zip(interval_lower, interval_upper))
            
        fit_mle = Fit_Weibull_2P(**fit_args)
        mle_beta = round(float(fit_mle.beta), 4)
        mle_alpha = round(float(fit_mle.alpha), 4)
        
        total_obs = len(failures) + len(right_censored) + len(left_censored) + len(interval_lower)
        mle_loglik = safe_round(getattr(fit_mle, 'loglik', None), 2)
        mle_aicc = "N/A" if total_obs <= 3 else safe_round(getattr(fit_mle, 'AICc', None), 2)
        mle_ad = safe_round(getattr(fit_mle, 'AD', None), 2)
        out['results_mle'] = {
            'beta': mle_beta,
            'alpha': mle_alpha,
            'pattern': get_weibull_pattern(mle_beta),
            'loglik': mle_loglik,
            'AICc': mle_aicc,
            'AD': mle_ad,
            'method': getattr(fit_mle, 'method', 'MLE')
        }
    except Exception as e:
        out['results_mle'] = { 'error': str(e) }

    # Rank Regression (method default 'LS' unless rr_method provided)
    try:
        # validate rr_method
        if rr_method not in ('LS', 'RRX', 'RRY'):
            rr_method = 'LS'
        fit_args_rr = {'failures': failures, 'method': rr_method, 'show_plot': False}
        
        if right_censored:
            fit_args_rr['right_censored'] = right_censored
        if left_censored:
            fit_args_rr['left_censored'] = left_censored
        if interval_lower and interval_upper:
            fit_args_rr['interval_censored'] = list(zip(interval_lower, interval_upper))
            
        fit_rr = Fit_Weibull_2P(**fit_args_rr)
        rr_beta = round(float(fit_rr.beta), 4)
        rr_alpha = round(float(fit_rr.alpha), 4)

        rr_loglik = safe_round(getattr(fit_rr, 'loglik', None), 2)
        rr_aicc = safe_round(getattr(fit_rr, 'AICc', None), 2)
        rr_ad = safe_round(getattr(fit_rr, 'AD', None), 2)

        out['results_rr'] = {
            'beta': rr_beta,
            'alpha': rr_alpha,
            'pattern': get_weibull_pattern(rr_beta),
            'loglik': rr_loglik,
            'AICc': rr_aicc,
            'AD': rr_ad,
            'method': getattr(fit_rr, 'method', 'LS'),
            'requested_method': rr_method
        }
    except Exception as e:
        out['results_rr'] = { 'error': str(e) }

    return jsonify(out)


@app.route('/api/plot', methods=['POST'])
def api_plot():
    """Return a PNG probability plot for the provided payload.
    Request JSON: same as /api/step2 plus:
      - plot_for: 'mle'|'rr' (which fit to plot)
      - rr_method: optional, passed to Fit_Weibull_2P when plotting rank regression
    Response JSON: { image: <base64 PNG> }
    """
    import io, base64
    if not request.is_json:
        return jsonify({'error': 'JSON required'}), 400
    data = request.get_json() or {}

    failures = data.get('failures') or []
    right_censored = data.get('right_censored') or []
    left_censored = data.get('left_censored') or []
    interval_data = data.get('interval_data') or []
    grouped_data = data.get('grouped_data') or []
    plot_for = data.get('plot_for', 'mle')
    rr_method = data.get('rr_method', 'LS')
    plot_type = data.get('plot_type', 'probability')

    # Build interval censoring arrays
    interval_lower = []
    interval_upper = []
    if interval_data:
        for item in interval_data:
            try:
                interval_lower.append(float(item['start']))
                interval_upper.append(float(item['end']))
            except Exception:
                return jsonify({'error': 'Invalid interval data format.'}), 400

    # Prepare fit args
    fit_args = {'failures': failures, 'show_probability_plot': False, 'show_plot': False, 'print_results': False}
    if right_censored:
        fit_args['right_censored'] = right_censored
    if left_censored:
        fit_args['left_censored'] = left_censored
    if interval_lower and interval_upper:
        fit_args['interval_censored'] = list(zip(interval_lower, interval_upper))

    try:
        # Allow direct plotting from provided alpha/beta (skip fitting)
        provided_alpha = data.get('alpha')
        provided_beta = data.get('beta')
        if provided_alpha is not None and provided_beta is not None:
            try:
                alpha = float(provided_alpha)
                beta = float(provided_beta)
            except Exception:
                return jsonify({'error': 'Invalid alpha/beta values.'}), 400
            # generate plot based on provided params below
            fitter = None
        else:
            fitter = None
        import matplotlib.pyplot as plt
        plt.figure(figsize=(8,5), dpi=120)

        # select method for fitting
        fa = fit_args.copy()
        if provided_alpha is None or provided_beta is None:
            # perform fitting only if alpha/beta not provided
            if plot_for == 'mle':
                fa['method'] = 'MLE'
                fitter = Fit_Weibull_2P(**fa)
            else:
                if rr_method not in ('LS', 'RRX', 'RRY'):
                    fa['method'] = 'LS'
                else:
                    fa['method'] = rr_method
                fitter = Fit_Weibull_2P(**fa)

        # get parameters (either from fitter or provided)
        if fitter is not None:
            alpha = float(getattr(fitter, 'alpha', None))
            beta = float(getattr(fitter, 'beta', None))
        else:
            # provided_alpha/provided_beta already validated above
            alpha = float(provided_alpha)
            beta = float(provided_beta)

        # Plot types
        if plot_type == 'probability':
            # Use the library's probability plot if available
            try:
                Fit_Weibull_2P(**{**fa, 'show_probability_plot': True, 'show_plot': True, 'print_results': False})
                buf = io.BytesIO()
                plt.tight_layout()
                plt.savefig(buf, format='png')
            except Exception:
                import numpy as _np
                sorted_failures = sorted(failures)
                n = len(sorted_failures)
                if n > 0:
                    ranks = _np.arange(1, n+1)
                    F = (ranks - 0.3) / (n + 0.4)
                    X = _np.log(sorted_failures)
                    Y = _np.log(-_np.log(1 - F))
                    plt.scatter(X, Y, label='Data')
                    xs = _np.linspace(min(X)*0.9, max(X)*1.1, 100)
                    ys = beta * xs - beta * _np.log(alpha)
                    plt.plot(xs, ys, color='C1', label=f'Fit (β={beta:.3f})')
                    plt.xlabel('ln(Time)')
                    plt.ylabel('ln(-ln(1-F))')
                    plt.legend()
                buf = io.BytesIO()
                plt.tight_layout()
                plt.savefig(buf, format='png')

        elif plot_type == 'reliability':
            import numpy as _np
            max_t = max(failures) if failures else (alpha * 3 if alpha else 100)
            t = _np.linspace(0.01, max_t * 1.2, 300)
            R = _np.exp(- (t / alpha) ** beta)
            plt.plot(t, R, label='Reliability R(t)')
            plt.xlabel('Time')
            plt.ylabel('Reliability')
            plt.ylim(-0.02, 1.02)
            plt.grid(True)
            plt.legend()
            buf = io.BytesIO()
            plt.tight_layout()
            plt.savefig(buf, format='png')

        elif plot_type == 'pdf':
            import numpy as _np
            max_t = max(failures) if failures else (alpha * 3 if alpha else 100)
            t = _np.linspace(0.01, max_t * 1.2, 300)
            pdf = (beta/alpha) * (t/alpha) ** (beta - 1) * _np.exp(- (t/alpha) ** beta)
            if failures:
                plt.hist(failures, bins=min(30, max(3, int(len(failures)/1))), density=True, alpha=0.4, label='Data histogram')
            plt.plot(t, pdf, label='Weibull PDF')
            plt.xlabel('Time')
            plt.ylabel('Density')
            plt.legend()
            buf = io.BytesIO()
            plt.tight_layout()
            plt.savefig(buf, format='png')

        else:
            return jsonify({'error': 'Unknown plot_type'}), 400

        plt.close('all')
        buf.seek(0)
        img_b64 = base64.b64encode(buf.read()).decode('ascii')
        return jsonify({'image': img_b64, 'alpha': alpha, 'beta': beta})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/reliability', methods=['POST'])
def api_reliability():
    """Compute mission time or MTBF from a chosen fit result.
    Expects JSON: { chosen_method, results: {alpha,beta,pattern}, reliability_level }
    Returns: { result: { alpha, beta, pattern, mission_time | mtbf, ... } }
    """
    if not request.is_json:
        return jsonify({'error': 'JSON required'}), 400
    data = request.get_json() or {}
    chosen_method = data.get('chosen_method', 'mle')
    results = data.get('results') or {}
    reliability_level = data.get('reliability_level')

    if not results or 'beta' not in results or 'alpha' not in results:
        return jsonify({'error': 'results object with beta and alpha required'}), 400

    try:
        beta = float(results.get('beta'))
        alpha = float(results.get('alpha'))
    except Exception:
        return jsonify({'error': 'Invalid alpha/beta in results'}), 400

    pattern = results.get('pattern')
    output = { 'beta': beta, 'alpha': alpha, 'pattern': pattern }

    if pattern == 'Age-related failure' and reliability_level:
        try:
            rl = float(reliability_level)
            mission_time_hours = float(alpha) * (-np.log(rl))**(1/float(beta))
            output['reliability'] = rl
            output['mission_time'] = round(mission_time_hours, 2)
            output['mission_time_days'], output['mission_time_months'], output['mission_time_years'] = convert_hours(mission_time_hours)
        except Exception as e:
            return jsonify({'error': f'Could not compute mission time: {e}'}), 400

    elif pattern == 'Random failure':
        try:
            mtbf_hours = float(alpha) * scipy.special.gamma(1 + 1/float(beta))
            output['mtbf'] = round(mtbf_hours, 2)
            output['mtbf_days'], output['mtbf_months'], output['mtbf_years'] = convert_hours(mtbf_hours)

            non_safety_hours = mtbf_hours * 2 * 0.02
            output['non_safety_calc'] = round(non_safety_hours, 2)
            output['non_safety_calc_days'], output['non_safety_calc_months'], output['non_safety_calc_years'] = convert_hours(non_safety_hours)

            safety_hours = mtbf_hours * 2 * 0.01
            output['safety_calc'] = round(safety_hours, 2)
            output['safety_calc_days'], output['safety_calc_months'], output['safety_calc_years'] = convert_hours(safety_hours)
        except Exception as e:
            return jsonify({'error': f'Could not compute MTBF: {e}'}), 400

    # If pattern unknown or reliability not provided, return basic info
    return jsonify({'result': output})


@app.route('/api/health', methods=['GET'])
def api_health():
    """Simple health check endpoint."""
    return jsonify({'status': 'ok'}), 200


@app.route("/step2", methods=["GET", "POST"])
def step2_input():
    # This block handles the form submission AFTER the user clicks "Next"
    if request.method == "POST":
        method = session.get("input_method", "failure")
        error = None
        failures, censored = [], []
        
        for i in range(1, 26):
            if method == "failure":
                tval = request.form.get(f"time_failed_{i}", "").strip()
                if tval:
                    try: failures.append(float(tval))
                    except ValueError: pass
            else:
                state = request.form.get(f"state_{i}", "").strip().upper()
                tval = request.form.get(f"time_{i}", "").strip()
                if tval and state in ("F", "S"):
                    try:
                        tval = float(tval)
                        if state == "F": failures.append(tval)
                        elif state == "S": censored.append(tval)
                    except ValueError: pass
        
        if (method == "failure" and len(failures) < 2) or (method != "failure" and len(failures) < 1):
             error = "Please enter sufficient valid failure times."
             return render_template("step2_input.html", method=method, error=error)

        session["failures"] = failures
        session["censored"] = censored

        try:
            fit_mle = Fit_Weibull_2P(failures=failures, right_censored=censored, show_plot=False)
            mle_beta = round(float(fit_mle.beta), 4)
            mle_alpha = round(float(fit_mle.alpha), 4)
            session["results_mle"] = { "beta": mle_beta, "alpha": mle_alpha, "pattern": get_weibull_pattern(mle_beta),"loglik": round(fit_mle.loglik, 2),"AICc": "N/A" if len(failures) + len(censored) <=3 else round(fit_mle.AICc, 2),"AD": round(fit_mle.AD, 2)}
        except Exception as e:
            session["results_mle"] = {"error": str(e)}

        try:
            fit_rr = Fit_Weibull_2P(failures=failures, right_censored=censored, method='LS', show_plot=False)
            rr_beta = round(float(fit_rr.beta), 4)
            rr_alpha = round(float(fit_rr.alpha), 4)
            session["results_rr"] = {"beta": rr_beta, "alpha": rr_alpha, "pattern": get_weibull_pattern(rr_beta),"loglik": round(fit_rr.loglik, 2),"AICc": round(fit_rr.AICc, 2),"AD": round(fit_rr.AD, 2)}
        except Exception as e:
            session["results_rr"] = {"error": str(e)}
        
        return redirect(url_for("step3_choose_method"))

    # --- UPDATED GET REQUEST LOGIC ---
    # This block now runs when the page loads, BEFORE the template is rendered.
    method = session.get("input_method", "failure")
    error = None
    pre_filled_data = []
    pre_filled_failures = session.pop('pre_filled_failures', None)
    
    if pre_filled_failures:
        # NEW: Rule 1: If fewer than 3 failures were calculated...
        if len(pre_filled_failures) < 3:
            session['input_method'] = 'censored' # Force method to censored mode
            flash('Warning: Fewer than 3 failures found. Data is being treated as censored, and a new suspension time from the last event until today has been added.')
            
            # Add existing TTFs as Failures ('F')
            for f_time in pre_filled_failures:
                pre_filled_data.append({'state': 'F', 'time': f_time})
            
            # Calculate and add the new Suspended ('S') data point
            if 'original_datetimes' in session:
                dt_strings = session.pop('original_datetimes', [])
                if dt_strings:
                    last_date = datetime.fromisoformat(dt_strings[-1])
                    today = datetime.now()
                    delta = today - last_date
                    new_suspension_hours = delta.total_seconds() / 3600
                    pre_filled_data.append({'state': 'S', 'time': round(new_suspension_hours, 0)})
        
        # NEW: Rule 2: If 3 or more failures were calculated...
        else:
            session['input_method'] = 'failure' # Force method to failure mode
            # Treat all as normal failures, passing only the time value
            for f_time in pre_filled_failures:
                pre_filled_data.append({'state': 'F', 'time': f_time}) # State is 'F' for consistency
    
    # Reload method from session in case the rules above changed it
    method = session.get("input_method", "failure") 
    return render_template("step2_input.html", method=method, error=error, pre_filled_data=pre_filled_data)

@app.route("/step3", methods=["GET", "POST"])
def step3_choose_method():
    if request.method == "POST":
        # (POST logic is unchanged)
        chosen_method = request.form.get("analysis_method", "mle")
        session["chosen_method"] = chosen_method
        chosen_results = session.get(f"results_{chosen_method}", {})
        pattern = chosen_results.get("pattern")
        if pattern == "Age-related failure":
            return redirect(url_for("step3b_reliability_level"))
        else:
            return redirect(url_for("step4_results"))

    # --- UPDATED RECOMMENDATION LOGIC (INCLUDES AICc) ---
    results_mle = session.get("results_mle", {})
    results_rr = session.get("results_rr", {})

    # Initialize scores and a counter for the metrics used
    mle_score = 0
    rr_score = 0
    metrics_counted = 0

    # Check 1: Log-Likelihood (Higher is better)
    if results_mle.get("loglik") and results_rr.get("loglik"):
        metrics_counted += 1
        if results_mle["loglik"] > results_rr["loglik"]:
            mle_score += 1
        elif results_rr["loglik"] > results_mle["loglik"]:
            rr_score += 1

    # Check 2: Anderson-Darling (Lower is better)
    if results_mle.get("AD") and results_rr.get("AD"):
        metrics_counted += 1
        if results_mle["AD"] < results_rr["AD"]:
            mle_score += 1
        elif results_rr["AD"] < results_mle["AD"]:
            rr_score += 1

    # Check 3: AICc (Lower is better) - ONLY if available
    if results_mle.get("AICc") != "N/A" and results_rr.get("AICc") is not None:
        metrics_counted += 1
        if results_mle["AICc"] < results_rr["AICc"]:
            mle_score += 1
        elif results_rr["AICc"] < results_mle["AICc"]:
            rr_score += 1

    # Determine the winner
    if mle_score > rr_score:
        recommendation_text = f"MLE is recommended, scoring better on {mle_score} out of {metrics_counted} metrics."
        recommended_method = 'mle'
    elif rr_score > mle_score:
        recommendation_text = f"Rank Regression is recommended, scoring better on {rr_score} out of {metrics_counted} metrics."
        recommended_method = 'rr'
    else:
        recommendation_text = "Both methods provide a very similar statistical fit."
        recommended_method = 'mle' # Default to MLE in case of a tie

    return render_template("step3_choose_method.html",
                           result_mle=results_mle,
                           result_rr=results_rr,
                           recommendation=recommendation_text,
                           recommended_method=recommended_method)

# (step3b_reliability_level and step4_results functions remain the same)
@app.route("/step3b_reliability", methods=["GET", "POST"])
def step3b_reliability_level():
    # ... (no changes)
    if request.method == "POST":
        reliability = request.form.get("reliability_level", "0.8")
        session["reliability_level"] = reliability
        return redirect(url_for("step4_results"))
    return render_template("step3b_reliability_level.html")

@app.route("/step4")
def step4_results():
    chosen_method = session.get("chosen_method", "mle")
    reliability_level = float(session.get("reliability_level", 0.8)) if session.get("reliability_level") else None
    final_results = session.get(f"results_{chosen_method}", {})
    
    if "error" in final_results or not final_results.get("beta"):
        return render_template("step4_results.html", result={"error": final_results.get("error", "Could not fit model.")})

    beta, alpha, pattern = final_results["beta"], final_results["alpha"], final_results["pattern"]
    output = {"beta": beta, "alpha": alpha, "pattern": pattern}

    if pattern == "Age-related failure" and reliability_level:
        output['reliability'] = reliability_level
        mission_time_hours = float(alpha) * (-np.log(reliability_level))**(1/float(beta))
        output['mission_time'] = round(mission_time_hours, 2)
        # NEW: Unpack three values
        output['mission_time_days'], output['mission_time_months'], output['mission_time_years'] = convert_hours(mission_time_hours)

    elif pattern == "Random failure":
        mtbf_hours = float(alpha) * scipy.special.gamma(1 + 1/float(beta))
        output['mtbf'] = round(mtbf_hours, 2)
        # NEW: Unpack three values
        output['mtbf_days'], output['mtbf_months'], output['mtbf_years'] = convert_hours(mtbf_hours)

        non_safety_hours = mtbf_hours * 2 * 0.02
        output['non_safety_calc'] = round(non_safety_hours, 2)
        # NEW: Unpack three values
        output['non_safety_calc_days'], output['non_safety_calc_months'], output['non_safety_calc_years'] = convert_hours(non_safety_hours)

        safety_hours = mtbf_hours * 2 * 0.01
        output['safety_calc'] = round(safety_hours, 2)
        # NEW: Unpack three values
        output['safety_calc_days'], output['safety_calc_months'], output['safety_calc_years'] = convert_hours(safety_hours)
    
    return render_template("step4_results.html", result=output)

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', '1') == '1'
    app.run(host='0.0.0.0', port=port, debug=debug)