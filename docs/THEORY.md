# Theory

How RCForge calculates, clause by clause. Everything here is the limit state method of
IS 456 : 2000. Symbols follow the code: $f_{ck}$ is the characteristic cube strength of concrete,
$f_y$ the characteristic strength of steel, $b$ the width, $d$ the effective depth, $x_u$ the depth
of the neutral axis.

The code is in `src/is456/`; each section below names the file that implements it.

## 1. Materials (`materials.ts`)

**Partial safety factors** (cl. 36.4.2): 1.5 on concrete, 1.15 on steel. The design strength of
concrete in the structure is taken as $0.67 f_{ck}$, so the peak design stress is

$$ \frac{0.67 f_{ck}}{1.5} = 0.446\, f_{ck} $$

and the design yield stress of steel is $f_y / 1.15 = 0.87 f_y$.

**Concrete stress–strain curve** (Fig. 21): a parabola up to a strain of 0.002 and a constant
stress from 0.002 to the ultimate strain of 0.0035:

$$
\sigma_c(\varepsilon) =
\begin{cases}
0.446 f_{ck}\left[2\dfrac{\varepsilon}{0.002} - \left(\dfrac{\varepsilon}{0.002}\right)^2\right] & \varepsilon < 0.002 \\
0.446 f_{ck} & 0.002 \le \varepsilon \le 0.0035
\end{cases}
$$

**Steel**: mild steel (Fe250) is elastic to $0.87 f_y$ and then flat. Cold-worked bars
(Fe415, Fe500, Fe550) follow the curve of Fig. 23A, which SP 16 tabulates as an inelastic strain
added to the elastic strain at six stress levels:

| Stress / $0.87 f_y$ | 0.80 | 0.85 | 0.90 | 0.95 | 0.975 | 1.00 |
| --- | --- | --- | --- | --- | --- | --- |
| Inelastic strain | 0 | 0.0001 | 0.0003 | 0.0007 | 0.0010 | 0.0020 |

RCForge interpolates linearly between these points. $E_s = 200\,000$ MPa.

## 2. The stress block (cl. 38.1)

For a rectangular compression zone of depth $x_u$ the strain varies linearly from 0.0035 at the
top to zero at the neutral axis. The strain reaches 0.002 at $\tfrac{3}{7}x_u$ from the top, so
the top $\tfrac37 x_u$ carries constant stress and the remaining $\tfrac47 x_u$ is parabolic.
Integrating,

$$ C = 0.446 f_{ck}\, b \left[\tfrac{3}{7}x_u + \tfrac{2}{3}\cdot\tfrac{4}{7}x_u\right]
     = 0.446 \times \tfrac{17}{21}\, f_{ck}\, b\, x_u = 0.36\, f_{ck}\, b\, x_u $$

acting at $\tfrac{99}{238}x_u = 0.42\,x_u$ from the top. The code rounds to 0.36 and 0.42; the
exact values are 0.3616 and 0.416.

**Limiting neutral axis.** To make sure the steel yields before the concrete crushes, its strain
at failure must be at least $0.87 f_y / E_s + 0.002$ (cl. 38.1 f). From similar triangles,

$$ \frac{x_{u,max}}{d} = \frac{0.0035}{0.0055 + 0.87 f_y / E_s} $$

which gives 0.53, 0.48 and 0.46 for Fe250, Fe415 and Fe500.

## 3. Beams in flexure (`flexure.ts`, Annex G)

**Singly reinforced.** Equilibrium $C = T$ and moments about the tension steel give

$$ x_u = \frac{0.87 f_y A_{st}}{0.36 f_{ck} b}, \qquad
   M_u = 0.87 f_y A_{st}\, d \left(1 - \frac{A_{st} f_y}{b\, d\, f_{ck}}\right) $$

Solving the second for the steel:

$$ A_{st} = \frac{0.5 f_{ck}}{f_y}\left[1 - \sqrt{1 - \frac{4.6 M_u}{f_{ck} b d^2}}\right] b d $$

The largest moment a singly reinforced section can carry is with $x_u = x_{u,max}$:

$$ M_{u,lim} = 0.36\,\frac{x_{u,max}}{d}\left(1 - 0.42\frac{x_{u,max}}{d}\right) f_{ck} b d^2 $$

that is $0.148$, $0.138$ and $0.133\, f_{ck} b d^2$ for the three grades.

> The code rounds the "4.6" formula and the 0.36 / 0.42 block independently, so designing with
> one and analysing with the other agrees to about 0.2 %, not exactly. RCForge designs with the
> formula (as every textbook does) and reports capacities from the block.

**Doubly reinforced** (G-1.2). When $M_u > M_{u,lim}$ the concrete carries $M_{u,lim}$ and a
couple of compression and extra tension steel carries the rest, $M_{u2} = M_u - M_{u,lim}$:

$$ A_{sc} = \frac{M_{u2}}{(f_{sc} - f_{cc})(d - d')}, \qquad
   A_{st} = \frac{0.36 f_{ck} b\, x_{u,max}}{0.87 f_y} + \frac{A_{sc}(f_{sc} - f_{cc})}{0.87 f_y} $$

$f_{sc}$ is read from the steel curve at the strain $0.0035(1 - d'/x_{u,max})$ and
$f_{cc} = 0.446 f_{ck}$ allows for the concrete the bars displace.

**Flanged beams** (G-2). If the neutral axis is in the flange the beam is a rectangle of width
$b_f$. Otherwise the web and the overhanging flange are treated separately:

$$ M_u = 0.36 f_{ck} b_w x_u (d - 0.42 x_u) + 0.45 f_{ck}(b_f - b_w)\, y_f \left(d - \frac{y_f}{2}\right) $$

with $y_f = D_f$ when the flange lies wholly in the constant-stress part of the block
($D_f \le \tfrac37 x_u$) and $y_f = 0.15 x_u + 0.65 D_f$ otherwise. RCForge solves this for $x_u$
by bisection. The effective flange width is $l_0/6 + b_w + 6 D_f$ for a T-beam and
$l_0/12 + b_w + 3 D_f$ for an L-beam (cl. 23.1.2).

**Limits** (cl. 26.5.1): $A_{st} \ge 0.85\, b\, d / f_y$ and neither face more than $0.04\, b D$.

## 4. Shear (`shear.ts`, cl. 40)

$$ \tau_v = \frac{V_u}{b\, d} $$

The concrete's own strength $\tau_c$ depends on the grade and on the tension steel
$p_t = 100 A_{st}/(b d)$. Table 19 follows the expression in SP 16:

$$ \tau_c = \frac{0.85\sqrt{0.8 f_{ck}}\left(\sqrt{1 + 5\beta} - 1\right)}{6\beta},
   \qquad \beta = \frac{0.8 f_{ck}}{6.89\, p_t} \ge 1 $$

- $\tau_v > \tau_{c,max}$ (Table 20): the section is too small.
- $\tau_v > \tau_c$: stirrups carry $V_{us} = V_u - \tau_c b d$ at spacing
  $s_v = 0.87 f_y A_{sv} d / V_{us}$.
- Always: minimum stirrups $A_{sv}/(b\, s_v) \ge 0.4/(0.87 f_y)$, and $s_v \le 0.75 d$, 300 mm.

In slabs $\tau_c$ is multiplied by $k$, from 1.30 for a 150 mm slab to 1.00 at 300 mm (cl. 40.2.1.1).

## 5. Deflection (`serviceability.ts`, cl. 23.2.1)

Deflection is controlled by limiting the span to effective depth ratio: 7 for cantilevers, 20 for
simply supported and 26 for continuous spans, multiplied by

- $10/\text{span}$ for spans over 10 m,
- a factor for tension steel (Fig. 4), which SP 24 gives as
  $k_t = \dfrac{1}{0.225 + 0.00322 f_s - 0.625 \log_{10}(1/p_t)} \le 2$ with
  $f_s = 0.58 f_y \times A_{st,req}/A_{st,prov}$,
- a factor for compression steel (Fig. 5), $k_c = 1 + p_c/(3 + p_c) \le 1.5$,
- a reduction for flanged beams (Fig. 6), 0.8 when $b_w/b_f \le 0.3$.

## 6. Anchorage (`anchorage.ts`, cl. 26.2)

A bar stressed to $0.87 f_y$ needs enough embedded surface for bond to resist it:

$$ \pi\phi\, L_d\, \tau_{bd} = \frac{\pi\phi^2}{4}\, 0.87 f_y
   \quad\Longrightarrow\quad L_d = \frac{\phi\; 0.87 f_y}{4\,\tau_{bd}} $$

$\tau_{bd}$ is 1.2, 1.4, 1.5, 1.7 and 1.9 MPa for M20 to M40, 60 % more for deformed bars and a
further 25 % more in compression.

## 7. Columns (`column.ts`, cl. 39)

**Strain profile.** With the neutral axis inside the section the extreme fibre is at 0.0035. With
it outside, the whole section is in compression and the code limits the strain to

$$ \varepsilon_{top} = 0.0035 - 0.75\,\varepsilon_{bottom} $$

which makes the profile pivot about a strain of 0.002 at $\tfrac37 D$ from the more compressed
face, and gives a uniform 0.002 in pure compression.

**Interaction diagram.** For a chosen neutral axis depth $x_u$ the strain at every point is known.
RCForge integrates the concrete stress over the compressed area (Gauss quadrature, so circles are
handled as easily as rectangles) and adds the force in each bar from the steel curve, less the
concrete it displaces:

$$ P_u = \int \sigma_c\, b(y)\, dy + \sum_i (f_{si} - f_{ci}) A_{si}, \qquad
   M_u = \int \sigma_c\, b(y)\, y\, dy + \sum_i (f_{si} - f_{ci}) A_{si}\, y_i $$

Sweeping $x_u$ from very large (pure compression) to zero (pure tension) traces the curve. The
capacity at a given $P_u$ is found by solving for the $x_u$ that gives that load.

**Minimum eccentricity** (cl. 25.4): $e_{min} = l/500 + D/30 \ge 20$ mm, about one axis at a time.

**Slender columns** (cl. 39.7.1). If $l_{ex}/D$ or $l_{ey}/b \ge 12$, additional moments allow for
the deflection of the column:

$$ M_{ax} = \frac{P_u D}{2000}\left(\frac{l_{ex}}{D}\right)^2, \qquad
   M_{ay} = \frac{P_u b}{2000}\left(\frac{l_{ey}}{b}\right)^2 $$

reduced by $k = (P_{uz} - P_u)/(P_{uz} - P_b) \le 1$, where $P_b$ is the load at balanced failure.

**Biaxial bending** (cl. 39.6):

$$ \left(\frac{M_{ux}}{M_{ux1}}\right)^{\alpha_n} + \left(\frac{M_{uy}}{M_{uy1}}\right)^{\alpha_n} \le 1,
   \qquad P_{uz} = 0.45 f_{ck} A_c + 0.75 f_y A_{sc} $$

with $\alpha_n = 1$ for $P_u/P_{uz} \le 0.2$, 2 for $\ge 0.8$, and linear in between.

## 8. Slabs (`slab.ts`, cl. 24, Annex D)

Slabs are designed as beams one metre wide. **One-way** slabs use $w l^2/8$, or the Table 12
coefficients when continuous ($w_d l^2/12 + w_l l^2/10$ in the end span, $w_d l^2/10 + w_l l^2/9$
at the first interior support).

**Two-way, simply supported** (Table 27). The Rankine–Grashoff method shares the load between two
strips so that they deflect equally at the centre. Since deflection goes as $w l^4$,

$$ w_x l_x^4 = w_y l_y^4 \quad\Longrightarrow\quad
   \alpha_x = \frac{1}{8}\,\frac{r^4}{1 + r^4}, \qquad \alpha_y = \frac{1}{8}\,\frac{r^2}{1 + r^4},
   \qquad r = \frac{l_y}{l_x} $$

and $M_x = \alpha_x w l_x^2$, $M_y = \alpha_y w l_x^2$.

**Two-way, restrained** (Table 26). The nine cases come from yield-line analysis. In the
long-span direction the midspan coefficient depends only on the number of discontinuous edges
$N_d$:

$$ \alpha_y^{+} = \frac{24 + 2 N_d + 1.5 N_d^2}{1000} $$

and moments over continuous edges are $\tfrac43$ of the midspan values. IS 456 prints the
short-span coefficients as a table; RCForge stores that table and uses these relations to check
it (see VALIDATION.md).

Minimum steel is 0.12 % of the gross section for deformed bars; bars are spaced at no more than
$3d$ or 300 mm, and are no larger than $D/8$.

## 9. Footings (`footing.ts`, cl. 34)

1. **Area** from the service load, with 10 % added for the footing and backfill:
   $A = 1.1 P / q_{safe}$.
2. **Design pressure** from the factored load without self-weight: $q_u = 1.5 P / (L B)$.
3. **Bending** at the face of the column, the footing acting as a cantilever of projection $a$:
   $M_u = q_u B a^2 / 2$.
4. **One-way shear** at $d$ from the face: $V_u = q_u B (a - d)$, checked against $\tau_c$.
5. **Punching shear** (cl. 31.6) on a perimeter $d/2$ from the column:
   $\tau_v = V_u / (b_0 d) \le k_s \times 0.25\sqrt{f_{ck}}$, with
   $k_s = 0.5 + \beta_c \le 1$ and $\beta_c$ the ratio of the column's short side to its long side.
6. **Anchorage**: the bars need $L_d$ beyond the column face.
7. **Bearing** under the column (cl. 34.4): $0.45 f_{ck}\sqrt{A_1/A_2}$, the root limited to 2.

The depth is the smallest, in 25 mm steps, that satisfies both shear checks.

## 10. What is left out

Torsion, crack width calculation, moment redistribution, shear in columns, ductile detailing to
IS 13920, combined and strap footings, flat slabs, and load combinations other than
1.5 (DL + LL). The app designs one section; it does not analyse a structure
([FrameForge](https://github.com/WruceBayne29/frameforge) does that for steel frames).

## References

- IS 456 : 2000, *Plain and Reinforced Concrete — Code of Practice*, Bureau of Indian Standards.
- SP 16 : 1980, *Design Aids for Reinforced Concrete to IS 456 : 1978*.
- SP 24 : 1983, *Explanatory Handbook on IS 456 : 1978*.
- P. C. Varghese, *Limit State Design of Reinforced Concrete*.
- S. U. Pillai and D. Menon, *Reinforced Concrete Design*.
- BS 8110-1 : 1997, cl. 3.5.3.5 (the yield-line equations behind the restrained slab coefficients).
